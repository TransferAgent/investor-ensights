// MT-3: move Tableicity per-tenant data from public.* → tenant_tableicity.*
// in ONE transaction. Provision happens INSIDE the transaction per the
// Sequencing Rule (gate doc, MT-2 close).
//
// Default = dry-run (does everything, then ROLLBACK).
// `--confirm` = real COMMIT.
//
// Public copies are left in place per gate DoD (rollback safety for one
// gate; dropped at MT-8). Idempotent: refuses to run if tenants row for
// 'tableicity' already exists.
//
// Usage:
//   npx tsx scripts/mt3-move-tableicity.ts            # dry-run
//   npx tsx scripts/mt3-move-tableicity.ts --confirm  # real run
//   DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/mt3-move-tableicity.ts --confirm  # prod

import pg from "pg";
import { PER_TENANT_TABLES } from "../lib/tenant/perTenantTables";
import { provisionTenantSchemaWithClient } from "../lib/tenant/provisioner";

const SLUG = "tableicity";
const SCHEMA = `tenant_${SLUG}`;
const TENANT_ROW = {
  slug: SLUG,
  personaDisplayName: "Tableicity",
  publisherName: "Investor Ensights",
  authorName: "Investor Ensights",
};

interface FkRow {
  constraint_name: string;
  src_table: string; src_col: string;
  tgt_table: string; tgt_col: string;
  delete_rule: string; update_rule: string;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

  console.log(`MT-3: Tableicity data move`);
  console.log(`  mode: ${confirm ? "CONFIRM (will COMMIT)" : "DRY-RUN (will ROLLBACK)"}`);
  console.log(`  database: ${url.replace(/:[^:@]*@/, ":***@")}`);
  console.log("");

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // (0) Operational safety rails (architect rec, MT-3 close):
    //   - statement_timeout: bound any single query (5 min — generous for prod copy).
    //   - lock_timeout: fail fast if locks can't be acquired in 30s instead of hanging.
    //   - pg_advisory_xact_lock: process-wide mutex on a constant key
    //     (5318 = "MT-3"). Prevents two operators running --confirm in parallel.
    await client.query(`SET LOCAL statement_timeout = '5min'`);
    await client.query(`SET LOCAL lock_timeout = '30s'`);
    await client.query(`SELECT pg_advisory_xact_lock(5318)`);

    // (1) Idempotency gate.
    const existing = await client.query(
      `SELECT 1 FROM public.tenants WHERE slug = $1`, [SLUG]
    );
    if ((existing.rowCount ?? 0) > 0) {
      throw new Error(`tenants.slug='${SLUG}' already exists — MT-3 already ran. Aborting.`);
    }

    // (2a) WRITE FREEZE: lock every public.<per-tenant table> in EXCLUSIVE
    // mode. EXCLUSIVE blocks ROW EXCLUSIVE (INSERT/UPDATE/DELETE) but allows
    // ACCESS SHARE (SELECT) — readers continue, writers block until COMMIT.
    // Acquired before any data is read so no concurrent writer can sneak in
    // a row after our copy snapshot but before our cutover.
    console.log("(2a) locking public per-tenant tables (EXCLUSIVE; reads still allowed) ...");
    for (const t of PER_TENANT_TABLES) {
      await client.query(`LOCK TABLE public."${t}" IN EXCLUSIVE MODE`);
    }

    // (2b) Provision tenant_tableicity INSIDE this same transaction so
    // schema creation rolls back together with everything else (closes
    // the atomicity gap architect flagged).
    console.log("(2b) provisioning tenant_tableicity (in-transaction) ...");
    const prov = await provisionTenantSchemaWithClient(client, SLUG);
    if (prov.tablesCreated.length !== PER_TENANT_TABLES.size) {
      throw new Error(`Expected ${PER_TENANT_TABLES.size} shells, got ${prov.tablesCreated.length}`);
    }

    // (3) Copy per-tenant data, table-by-table.
    console.log("(3) copying data public.* → tenant_tableicity.* ...");
    const counts: Array<{ table: string; pub: number; ten: number }> = [];
    for (const t of PER_TENANT_TABLES) {
      await client.query(`INSERT INTO "${SCHEMA}"."${t}" SELECT * FROM public."${t}"`);
      const r1 = await client.query(`SELECT count(*)::int AS n FROM public."${t}"`);
      const r2 = await client.query(`SELECT count(*)::int AS n FROM "${SCHEMA}"."${t}"`);
      const pub = r1.rows[0].n, ten = r2.rows[0].n;
      counts.push({ table: t, pub, ten });
      if (pub !== ten) throw new Error(`count mismatch for ${t}: public=${pub}, tenant=${ten}`);
    }
    console.log(`    copied ${counts.reduce((s, c) => s + c.ten, 0)} rows across ${counts.length} tables`);

    // (4) Reconstruct FKs (discovered dynamically from public).
    console.log("(4) reconstructing FKs in tenant_tableicity ...");
    const tableArr = [...PER_TENANT_TABLES];
    const fkRes = await client.query<FkRow>(`
      SELECT tc.constraint_name, tc.table_name AS src_table, kcu.column_name AS src_col,
             ccu.table_name AS tgt_table, ccu.column_name AS tgt_col,
             rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
       AND ccu.table_schema = 'public'
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ANY($1::text[]) AND ccu.table_name = ANY($1::text[])
      ORDER BY tc.table_name, tc.constraint_name`, [tableArr]);

    // Architect note: FK rebuild assumes single-column FKs. The script
    // queries kcu/ccu without aggregating column lists, so a composite FK
    // would silently fan out into multiple ALTERs, each missing columns.
    // Detect and abort instead of producing a broken constraint.
    const fkNameCounts = new Map<string, number>();
    for (const fk of fkRes.rows) fkNameCounts.set(fk.constraint_name, (fkNameCounts.get(fk.constraint_name) ?? 0) + 1);
    const composite = [...fkNameCounts.entries()].filter(([, n]) => n > 1);
    if (composite.length > 0) {
      throw new Error(`Composite FKs detected — script not designed for them: ${composite.map(([n]) => n).join(", ")}`);
    }

    for (const fk of fkRes.rows) {
      const ddl = `ALTER TABLE "${SCHEMA}"."${fk.src_table}"
        ADD CONSTRAINT "${fk.constraint_name}"
        FOREIGN KEY ("${fk.src_col}")
        REFERENCES "${SCHEMA}"."${fk.tgt_table}" ("${fk.tgt_col}")
        ON DELETE ${fk.delete_rule} ON UPDATE ${fk.update_rule}`;
      await client.query(ddl);
    }
    console.log(`    reconstructed ${fkRes.rowCount} FKs`);

    // (5) Insert public.tenants row.
    console.log("(5) inserting public.tenants row for 'tableicity' ...");
    await client.query(
      `INSERT INTO public.tenants (slug, persona_display_name, publisher_name, author_name)
       VALUES ($1, $2, $3, $4)`,
      [TENANT_ROW.slug, TENANT_ROW.personaDisplayName, TENANT_ROW.publisherName, TENANT_ROW.authorName]
    );

    // (6) Populate public.city_slug_registry from tenant_tableicity.city_locations.
    // STRICT: any slug collision raises and aborts the whole transaction.
    // For the first-tenant move there must be zero registry rows already;
    // a collision would mean another tenant beat us to a Tableicity slug,
    // which is a hard data-integrity violation, not a thing to silently skip.
    console.log("(6) populating public.city_slug_registry (strict, no DO NOTHING) ...");
    const reg = await client.query(
      `INSERT INTO public.city_slug_registry (slug, tenant_slug, city_id)
       SELECT slug, $1, id FROM "${SCHEMA}".city_locations
       RETURNING slug`, [SLUG]
    );
    console.log(`    claimed ${reg.rowCount} city slugs for tenant '${SLUG}'`);

    // (7) Final summary BEFORE commit/rollback decision.
    console.log("");
    console.log("=== summary ===");
    for (const c of counts) {
      if (c.ten > 0) console.log(`  ${c.table}: ${c.pub} → ${c.ten}`);
    }
    console.log(`  tenants: +1 row ('${SLUG}')`);
    console.log(`  city_slug_registry: +${reg.rowCount} rows`);
    console.log(`  FKs reconstructed: ${fkRes.rowCount}`);

    if (confirm) {
      await client.query("COMMIT");
      console.log("\nCOMMITTED.");
    } else {
      await client.query("ROLLBACK");
      // Schema creation is now INSIDE our transaction — rollback wipes it
      // automatically. No external drop needed.
      console.log("\nROLLED BACK (dry-run). Re-run with --confirm to apply.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nFAILED — rolled back. All changes (schema, data, FKs, tenants row, registry) reverted.");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

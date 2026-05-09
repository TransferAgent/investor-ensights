// MT-3 DoD verification harness (read-only).
// Confirms post-MT-3 state: tenant_tableicity has all data, public copies
// untouched, registry + tenants row populated, FKs reconstructed.
//
// Usage: npx tsx scripts/mt3-verify.ts
//   DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/mt3-verify.ts  # against prod

import pg from "pg";
import { PER_TENANT_TABLES } from "../lib/tenant/perTenantTables";

interface Check { name: string; pass: boolean; detail: string; }

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });
  const checks: Check[] = [];

  try {
    // (a) tenants row exists with expected fields.
    const t = await pool.query(
      `SELECT slug, persona_display_name, publisher_name, author_name
       FROM public.tenants WHERE slug = 'tableicity'`
    );
    const row = t.rows[0];
    const tenantOk = !!row && row.persona_display_name === "Tableicity"
      && row.publisher_name === "Investor Ensights"
      && row.author_name === "Investor Ensights";
    checks.push({
      name: "(a) public.tenants has 'tableicity' with correct brand fields",
      pass: tenantOk,
      detail: row ? `display='${row.persona_display_name}', publisher='${row.publisher_name}'` : "MISSING",
    });

    // (b) Row counts match across schemas for every per-tenant table.
    let mismatches = 0;
    let totalRows = 0;
    const perTable: string[] = [];
    for (const tbl of PER_TENANT_TABLES) {
      const r = await pool.query(
        `SELECT (SELECT count(*)::int FROM public."${tbl}") AS pub,
                (SELECT count(*)::int FROM tenant_tableicity."${tbl}") AS ten`
      );
      const { pub, ten } = r.rows[0];
      totalRows += ten;
      if (pub !== ten) { mismatches++; perTable.push(`${tbl}: ${pub}≠${ten}`); }
    }
    checks.push({
      name: "(b) row counts match public.* vs tenant_tableicity.* for all 24 tables",
      pass: mismatches === 0,
      detail: mismatches === 0
        ? `${totalRows} rows mirrored across 24 tables`
        : `${mismatches} mismatches: ${perTable.join("; ")}`,
    });

    // (c) city_slug_registry rows = count(tenant_tableicity.city_locations).
    const r1 = await pool.query(
      `SELECT count(*)::int AS n FROM public.city_slug_registry WHERE tenant_slug = 'tableicity'`
    );
    const r2 = await pool.query(`SELECT count(*)::int AS n FROM tenant_tableicity.city_locations`);
    checks.push({
      name: "(c) city_slug_registry rows for 'tableicity' = tenant_tableicity.city_locations count",
      pass: r1.rows[0].n === r2.rows[0].n,
      detail: `registry=${r1.rows[0].n}, tenant=${r2.rows[0].n}`,
    });

    // (d) FKs reconstructed in tenant_tableicity (must match public's FK count among PER_TENANT_TABLES).
    const tableArr = [...PER_TENANT_TABLES];
    const fkSql = `SELECT count(*)::int AS n FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = $1
       WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_name = ANY($2::text[]) AND ccu.table_name = ANY($2::text[])`;
    const pubFk = await pool.query(fkSql, ["public", tableArr]);
    const tenFk = await pool.query(fkSql, ["tenant_tableicity", tableArr]);
    checks.push({
      name: "(d) FK count in tenant_tableicity matches public",
      pass: pubFk.rows[0].n === tenFk.rows[0].n && tenFk.rows[0].n > 0,
      detail: `public=${pubFk.rows[0].n}, tenant=${tenFk.rows[0].n}`,
    });

    // (e) public per-tenant tables still populated (rollback safety net per DoD).
    const cityPub = await pool.query(`SELECT count(*)::int AS n FROM public.city_locations`);
    checks.push({
      name: "(e) public.city_locations still populated (rollback safety net)",
      pass: cityPub.rows[0].n > 0,
      detail: `${cityPub.rows[0].n} rows`,
    });
  } finally {
    await pool.end();
  }

  console.log("\n=== MT-3 DoD Verification ===");
  let allPass = true;
  for (const c of checks) {
    console.log(`[${c.pass ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`);
    if (!c.pass) allPass = false;
  }
  console.log("\n" + (allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

// MT-2 DoD verification harness.
//
// SELF-CONTAINED: provisions tenant_tableicity, runs all 6 checks against
// the live shells, then drops the schema. Live state is unchanged before
// vs. after — no tenant_<slug> schemas remain. This is intentional: see
// the sequencing rule at the top of lib/tenant/provisioner.ts.
//
// Usage: npx tsx scripts/mt2-verify.ts

import pg from "pg";
import { PER_TENANT_TABLES } from "../lib/tenant/perTenantTables";
import { provisionTenantSchema, dropTenantSchema, tenantSchemaExists } from "../lib/tenant/provisioner";

interface Check { name: string; pass: boolean; detail: string; }

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
  const pool = new pg.Pool({ connectionString: url });
  const checks: Check[] = [];
  const slug = "tableicity";

  try {
    // Pre-condition: live state must be tenant-schema-free per sequencing rule.
    const preExisted = await tenantSchemaExists(pool, slug);
    if (preExisted) {
      console.log(`WARN: tenant_${slug} existed before verifier ran — dropping for clean slate.`);
      await dropTenantSchema(pool, slug);
    }

    // (1) Provision creates the schema and 24 shells.
    const first = await provisionTenantSchema(pool, slug);
    checks.push({
      name: "(a) provision creates tenant_tableicity with 24 shells",
      pass: first.tablesCreated.length === PER_TENANT_TABLES.size && first.tablesAlreadyPresent.length === 0,
      detail: `created=${first.tablesCreated.length}, already_present=${first.tablesAlreadyPresent.length}`,
    });

    // (2) public has the 5 NEW global tables from shared/schema.ts.
    const expectedNew = ["users", "tenants", "tenant_members", "email_verifications", "city_slug_registry"];
    const r3 = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [expectedNew]
    );
    const found = new Set(r3.rows.map((r: { table_name: string }) => r.table_name));
    const missingNew = expectedNew.filter((t) => !found.has(t));
    checks.push({
      name: "(b) public has all 5 new global tables",
      pass: missingNew.length === 0,
      detail: missingNew.length === 0 ? "all 5 present" : `missing: ${missingNew.join(", ")}`,
    });

    // (3) public still has all 24 per-tenant tables (untouched at MT-2).
    const r4 = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [[...PER_TENANT_TABLES]]
    );
    checks.push({
      name: "(c) public still has all 24 per-tenant tables (untouched)",
      pass: r4.rowCount === PER_TENANT_TABLES.size,
      detail: `${r4.rowCount}/${PER_TENANT_TABLES.size} present`,
    });

    // (4) tenant_tableicity shells are empty.
    const r5 = await pool.query(
      `SELECT (xpath('/row/c/text()',
        query_to_xml(format('SELECT count(*) AS c FROM tenant_tableicity.%I', table_name), false, true, '')))[1]::text::int AS n,
        table_name
       FROM information_schema.tables
       WHERE table_schema = 'tenant_tableicity' AND table_type = 'BASE TABLE'`
    );
    const nonEmpty = r5.rows.filter((r: { n: number }) => r.n > 0);
    checks.push({
      name: "(d) tenant_tableicity tables are empty (no data moved)",
      pass: nonEmpty.length === 0,
      detail: nonEmpty.length === 0 ? `all ${r5.rowCount} empty` : `non-empty: ${nonEmpty.length}`,
    });

    // (5) Idempotent — second call creates 0, reports 24 already present.
    const second = await provisionTenantSchema(pool, slug);
    checks.push({
      name: "(e) provisionTenantSchema is idempotent",
      pass: second.tablesCreated.length === 0 && second.tablesAlreadyPresent.length === PER_TENANT_TABLES.size,
      detail: `2nd call: created=${second.tablesCreated.length}, already=${second.tablesAlreadyPresent.length}`,
    });

    // (6) Slug + reserved-word validation rejects bad input.
    let rejected = 0;
    for (const bad of ["", "Public", "Tableicity", "1bad", "with-hyphen", "public", "admin"]) {
      try { await provisionTenantSchema(pool, bad); } catch { rejected++; }
    }
    checks.push({
      name: "(f) slug validator rejects malformed + reserved slugs",
      pass: rejected === 7,
      detail: `${rejected}/7 rejected`,
    });
  } finally {
    // Always restore the precondition: leave dev tenant-schema-free.
    try { await dropTenantSchema(pool, slug); } catch { /* best-effort */ }
    await pool.end();
  }

  console.log("\n=== MT-2 DoD Verification ===");
  let allPass = true;
  for (const c of checks) {
    console.log(`[${c.pass ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`);
    if (!c.pass) allPass = false;
  }
  console.log("\n" + (allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

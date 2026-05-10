/**
 * cleanup-tenant.ts
 *
 * Forcefully removes a tenant from PROD: drops the per-tenant schema and
 * deletes the tenant's rows from the global registry tables. Intended for
 * cleaning up orphaned / typo'd tenants where the user has already been
 * removed but the tenant footprint is left behind (blocking re-creation
 * of the slug with a 409 "tenant slug already exists").
 *
 * Cleans, in a single transaction:
 *   1. public.city_slug_registry  WHERE tenant_slug = $slug
 *   2. public.tenant_members      WHERE tenant_slug = $slug
 *   3. public.tenants             WHERE slug         = $slug
 *   4. DROP SCHEMA tenant_<slug> CASCADE
 *
 * Safety:
 *   - Default mode prints a plan only. Pass --confirm to actually write.
 *   - Refuses to touch the protected slug "tableicity".
 *   - Validates slug shape: lowercase letters, digits, underscore only.
 *   - Wraps all four steps in one transaction (rolls back on any error).
 *   - Reports row counts before and after so the operator can sanity-check.
 *
 * Usage:
 *   npx tsx scripts/cleanup-tenant.ts --slug=veltroy            # dry run
 *   npx tsx scripts/cleanup-tenant.ts --slug=veltroy --confirm  # execute
 */

import pg from "pg";

const PROD_URL = process.env.PROD_DATABASE_URL;
if (!PROD_URL) {
  console.error("Missing env var PROD_DATABASE_URL.");
  process.exit(1);
}

const args = process.argv.slice(2);
const slugArg = args.find((a) => a.startsWith("--slug="));
const CONFIRM = args.includes("--confirm");

if (!slugArg) {
  console.error("Missing --slug=<tenant_slug>");
  process.exit(1);
}
const slug = slugArg.slice("--slug=".length).trim();

if (!/^[a-z0-9_]+$/.test(slug)) {
  console.error(`Invalid slug shape: "${slug}" (allowed: a-z, 0-9, _)`);
  process.exit(1);
}
if (slug === "tableicity") {
  console.error('Refusing to clean up the protected "tableicity" tenant.');
  process.exit(1);
}

const schemaName = `tenant_${slug}`;

const pool = new pg.Pool({
  connectionString: PROD_URL,
  ssl: PROD_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
  max: 2,
});

async function counts(client: pg.PoolClient) {
  const tenant = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.tenants WHERE slug = $1`,
    [slug],
  );
  const members = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.tenant_members WHERE tenant_slug = $1`,
    [slug],
  );
  const cities = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.city_slug_registry WHERE tenant_slug = $1`,
    [slug],
  );
  const schema = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM information_schema.schemata WHERE schema_name = $1`,
    [schemaName],
  );
  return {
    tenants: tenant.rows[0].n,
    members: members.rows[0].n,
    cityRegistry: cities.rows[0].n,
    schemaExists: schema.rows[0].n === 1,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    const before = await counts(client);
    console.log(`\n[cleanup-tenant] target slug: "${slug}" (schema: ${schemaName})`);
    console.log(`[cleanup-tenant] BEFORE:`, before);

    if (
      before.tenants === 0 &&
      before.members === 0 &&
      before.cityRegistry === 0 &&
      !before.schemaExists
    ) {
      console.log(`[cleanup-tenant] nothing to clean — slug is already free.`);
      return;
    }

    if (!CONFIRM) {
      console.log(
        `[cleanup-tenant] DRY RUN. Re-run with --confirm to delete the rows above and DROP SCHEMA ${schemaName} CASCADE.`,
      );
      return;
    }

    await client.query("BEGIN");
    const r1 = await client.query(
      `DELETE FROM public.city_slug_registry WHERE tenant_slug = $1`,
      [slug],
    );
    const r2 = await client.query(
      `DELETE FROM public.tenant_members WHERE tenant_slug = $1`,
      [slug],
    );
    const r3 = await client.query(
      `DELETE FROM public.tenants WHERE slug = $1`,
      [slug],
    );
    // Identifier already validated by the regex above; safe to interpolate.
    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await client.query("COMMIT");

    console.log(`[cleanup-tenant] deleted city_slug_registry rows: ${r1.rowCount}`);
    console.log(`[cleanup-tenant] deleted tenant_members rows:    ${r2.rowCount}`);
    console.log(`[cleanup-tenant] deleted tenants rows:           ${r3.rowCount}`);
    console.log(`[cleanup-tenant] dropped schema:                 ${schemaName}`);

    const after = await counts(client);
    console.log(`[cleanup-tenant] AFTER:`, after);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error(`[cleanup-tenant] FAILED, rolled back:`, err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

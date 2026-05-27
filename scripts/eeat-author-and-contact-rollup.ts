/**
 * eeat-author-and-contact-rollup.ts
 *
 * F5 of the E-E-A-T rollout. Normalizes author identity + city contact info
 * to a single platform-wide source of truth in one atomic transaction:
 *
 *   (a) knowledge_articles across 5 tenants:
 *         author_name      -> 'John Reynolds'
 *         publisher_name   -> 'Investor Ensights'
 *
 *   (b) public.tenants (5 rows):
 *         author_name      -> 'John Reynolds'
 *         publisher_name   -> 'Investor Ensights'
 *
 *   (c) city_locations across 5 tenants:
 *         email            -> 'info@investorensights.com'
 *         phone_number     -> '(800) 684-8034'
 *
 * Idempotent: every UPDATE filters `WHERE col IS DISTINCT FROM target`, so
 * re-runs touch zero rows.
 *
 * Reverses the per-persona email work shipped earlier this morning
 * (scripts/fix-persona-emails.ts) per the corrected brand model:
 *   "the author is always Investor Ensights, regardless of persona."
 *
 * Usage:
 *   npx tsx scripts/eeat-author-and-contact-rollup.ts                   # dev, dry run
 *   npx tsx scripts/eeat-author-and-contact-rollup.ts --confirm         # dev, write
 *   npx tsx scripts/eeat-author-and-contact-rollup.ts --prod            # prod, dry run
 *   npx tsx scripts/eeat-author-and-contact-rollup.ts --prod --confirm  # prod, write
 */

import pg from "pg";

const TENANT_SLUGS = ["tableicity", "texitie", "veltroy", "haylo", "payrol"] as const;

const TARGET_AUTHOR_NAME = "Brian Reynolds";
const TARGET_PUBLISHER_NAME = "Investor Ensights";
const TARGET_EMAIL = "info@investorensights.com";
const TARGET_PHONE = "(800) 684-8034";

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirm");
const USE_PROD = args.has("--prod");

const DEV_URL = process.env.DATABASE_URL;
const PROD_URL = process.env.PROD_DATABASE_URL;
const TARGET_URL = USE_PROD ? PROD_URL : DEV_URL;
const TARGET_LABEL = USE_PROD ? "PROD" : "DEV";

if (!TARGET_URL) {
  console.error(`Missing ${USE_PROD ? "PROD_DATABASE_URL" : "DATABASE_URL"}.`);
  process.exit(1);
}
if (USE_PROD && DEV_URL && PROD_URL && DEV_URL === PROD_URL) {
  console.error("DEV and PROD URLs are identical — refusing to run against PROD.");
  process.exit(1);
}

interface PhaseResult {
  label: string;
  willChange: number;
  changed: number;
}

async function previewCount(
  client: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const r = await client.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

async function applyUpdate(
  client: pg.Client,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const r = await client.query(sql, params);
  return r.rowCount ?? 0;
}

async function schemaExists(client: pg.Client, schema: string): Promise<boolean> {
  const r = await client.query(
    "SELECT 1 FROM information_schema.schemata WHERE schema_name = $1",
    [schema],
  );
  return (r.rowCount ?? 0) > 0;
}

async function main() {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  console.log(`\nConnected to ${TARGET_LABEL}.`);
  console.log(`Mode: ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN (read-only)"}`);
  console.log(`Targets:`);
  console.log(`  author_name      = '${TARGET_AUTHOR_NAME}'`);
  console.log(`  publisher_name   = '${TARGET_PUBLISHER_NAME}'`);
  console.log(`  city.email       = '${TARGET_EMAIL}'`);
  console.log(`  city.phone_number= '${TARGET_PHONE}'\n`);

  const results: PhaseResult[] = [];

  try {
    if (CONFIRM) await client.query("BEGIN");

    // ---------- Phase A: knowledge_articles per tenant ----------
    console.log("=== Phase A: knowledge_articles ===");
    for (const slug of TENANT_SLUGS) {
      const schema = `tenant_${slug}`;
      if (!(await schemaExists(client, schema))) {
        console.log(`  [${slug}] schema missing — skip`);
        continue;
      }
      const previewSql = `
        SELECT COUNT(*)::int AS n FROM ${schema}.knowledge_articles
        WHERE author_name IS DISTINCT FROM $1 OR publisher_name IS DISTINCT FROM $2
      `;
      const willChange = await previewCount(client, previewSql, [
        TARGET_AUTHOR_NAME,
        TARGET_PUBLISHER_NAME,
      ]);
      let changed = 0;
      if (CONFIRM && willChange > 0) {
        const updateSql = `
          UPDATE ${schema}.knowledge_articles
          SET author_name = $1, publisher_name = $2
          WHERE author_name IS DISTINCT FROM $1 OR publisher_name IS DISTINCT FROM $2
        `;
        changed = await applyUpdate(client, updateSql, [
          TARGET_AUTHOR_NAME,
          TARGET_PUBLISHER_NAME,
        ]);
      }
      const label = `  [${slug}] articles`;
      console.log(
        CONFIRM
          ? `${label}: updated ${changed}/${willChange} row(s)`
          : `${label}: would update ${willChange} row(s)`,
      );
      results.push({ label: `articles:${slug}`, willChange, changed });
    }

    // ---------- Phase B: public.tenants ----------
    console.log("\n=== Phase B: public.tenants ===");
    const tenantsPreview = await previewCount(
      client,
      `SELECT COUNT(*)::int AS n FROM public.tenants
       WHERE slug = ANY($1::text[])
         AND (author_name IS DISTINCT FROM $2 OR publisher_name IS DISTINCT FROM $3)`,
      [TENANT_SLUGS, TARGET_AUTHOR_NAME, TARGET_PUBLISHER_NAME],
    );
    let tenantsChanged = 0;
    if (CONFIRM && tenantsPreview > 0) {
      tenantsChanged = await applyUpdate(
        client,
        `UPDATE public.tenants
         SET author_name = $2, publisher_name = $3
         WHERE slug = ANY($1::text[])
           AND (author_name IS DISTINCT FROM $2 OR publisher_name IS DISTINCT FROM $3)`,
        [TENANT_SLUGS, TARGET_AUTHOR_NAME, TARGET_PUBLISHER_NAME],
      );
    }
    console.log(
      CONFIRM
        ? `  public.tenants: updated ${tenantsChanged}/${tenantsPreview} row(s)`
        : `  public.tenants: would update ${tenantsPreview} row(s)`,
    );
    results.push({
      label: "tenants",
      willChange: tenantsPreview,
      changed: tenantsChanged,
    });

    // ---------- Phase C: city_locations per tenant ----------
    console.log("\n=== Phase C: city_locations ===");
    for (const slug of TENANT_SLUGS) {
      const schema = `tenant_${slug}`;
      if (!(await schemaExists(client, schema))) {
        console.log(`  [${slug}] schema missing — skip`);
        continue;
      }
      const previewSql = `
        SELECT COUNT(*)::int AS n FROM ${schema}.city_locations
        WHERE email IS DISTINCT FROM $1 OR phone_number IS DISTINCT FROM $2
      `;
      const willChange = await previewCount(client, previewSql, [
        TARGET_EMAIL,
        TARGET_PHONE,
      ]);
      let changed = 0;
      if (CONFIRM && willChange > 0) {
        const updateSql = `
          UPDATE ${schema}.city_locations
          SET email = $1, phone_number = $2, updated_at = NOW()
          WHERE email IS DISTINCT FROM $1 OR phone_number IS DISTINCT FROM $2
        `;
        changed = await applyUpdate(client, updateSql, [TARGET_EMAIL, TARGET_PHONE]);
      }
      const label = `  [${slug}] cities`;
      console.log(
        CONFIRM
          ? `${label}: updated ${changed}/${willChange} row(s)`
          : `${label}: would update ${willChange} row(s)`,
      );
      results.push({ label: `cities:${slug}`, willChange, changed });
    }

    // ---------- Commit or rollback dry-run ----------
    const totalWill = results.reduce((s, r) => s + r.willChange, 0);
    const totalChanged = results.reduce((s, r) => s + r.changed, 0);

    if (CONFIRM) {
      await client.query("COMMIT");
      console.log(`\n✅ Committed. Total rows changed: ${totalChanged}`);
    } else {
      console.log(`\nDRY RUN total rows that would change: ${totalWill}`);
      console.log("Re-run with --confirm to apply.");
    }
  } catch (err) {
    if (CONFIRM) {
      await client.query("ROLLBACK");
      console.error("\n❌ Rolled back due to error:", err);
    } else {
      console.error("\n❌ Dry-run error:", err);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

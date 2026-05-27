/**
 * fix-persona-emails.ts
 *
 * One-shot housekeeping: every non-Tableicity persona inherited the default
 * `info@tableicity.com` email on its 337 city rows when the tenant was first
 * seeded. This script rewrites those defaults to the persona's own contact
 * address. Tableicity is intentionally skipped (it has 25 customized per-city
 * emails we don't want to bulldoze).
 *
 * Idempotent: UPDATE ... WHERE email = 'info@tableicity.com', so re-runs are
 * no-ops on rows already rewritten.
 *
 * Usage:
 *   npx tsx scripts/fix-persona-emails.ts                   # dev, dry run
 *   npx tsx scripts/fix-persona-emails.ts --confirm         # dev, write
 *   npx tsx scripts/fix-persona-emails.ts --prod            # prod, dry run
 *   npx tsx scripts/fix-persona-emails.ts --prod --confirm  # prod, write
 */

import pg from "pg";

const PERSONA_EMAIL_MAP: Record<string, string> = {
  texitie: "info@textitie.com",
  veltroy: "info@veltroy.com",
  haylo: "info@haylo.com",
  payrol: "info@payrol.com",
};

const STALE_DEFAULT = "info@tableicity.com";

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

async function main() {
  const client = new pg.Client({ connectionString: TARGET_URL });
  await client.connect();
  console.log(`\nConnected to ${TARGET_LABEL}.`);
  console.log(`Mode: ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN (read-only)"}`);
  console.log(`Stale default to rewrite: ${STALE_DEFAULT}\n`);

  let grandTotal = 0;
  try {
    if (CONFIRM) await client.query("BEGIN");

    for (const [slug, targetEmail] of Object.entries(PERSONA_EMAIL_MAP)) {
      const schema = `tenant_${slug}`;
      const schemaCheck = await client.query(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = $1",
        [schema],
      );
      if (schemaCheck.rowCount === 0) {
        console.log(`[${slug}] schema ${schema} not found — skipping`);
        continue;
      }

      const before = await client.query(
        `SELECT COUNT(*)::int AS n FROM ${schema}.city_locations WHERE email = $1`,
        [STALE_DEFAULT],
      );
      const willChange = before.rows[0].n as number;

      if (willChange === 0) {
        console.log(`[${slug}] 0 rows on stale default — nothing to do`);
        continue;
      }

      if (CONFIRM) {
        const upd = await client.query(
          `UPDATE ${schema}.city_locations SET email = $1, updated_at = NOW() WHERE email = $2`,
          [targetEmail, STALE_DEFAULT],
        );
        console.log(
          `[${slug}] UPDATED ${upd.rowCount} row(s) → ${targetEmail}`,
        );
        grandTotal += upd.rowCount ?? 0;
      } else {
        console.log(
          `[${slug}] would UPDATE ${willChange} row(s) → ${targetEmail}`,
        );
        grandTotal += willChange;
      }
    }

    if (CONFIRM) {
      await client.query("COMMIT");
      console.log(`\n✅ Committed. Total rows changed: ${grandTotal}`);
    } else {
      console.log(`\nDRY RUN total rows that would change: ${grandTotal}`);
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

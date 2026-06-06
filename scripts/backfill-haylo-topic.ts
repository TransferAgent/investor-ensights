/**
 * backfill-haylo-topic.ts
 *
 * One-time rescue for Haylo essays imported via the Halo API BEFORE the
 * pull path learned to derive a Topic Slug. Those rows landed with
 * `topic_slug = NULL` (see app/api/admin/haylo-articles/pull-from-halo),
 * which traps them in Draft because the Library edit form refuses to save
 * an essay Ready without a Topic Slug (app/admin/haylo/page.tsx).
 *
 * This fills `topic_slug` (only where empty) by deriving it from the title
 * with the SAME `slugifyHaylo` the live ingest paths use, so the data is
 * identical to a fresh import after the forward fix. It does NOT touch
 * status, slug, body, or any timestamp — promoting Draft→Ready stays a
 * separate, deliberate step.
 *
 * Safety:
 *   - Forward-only: only rows where topic_slug IS NULL OR ''. Never overwrites.
 *   - Scoped to source='halo_api' by default (the only path that nulled topic).
 *   - Dry-run by default. `--confirm` writes, inside ONE transaction + audit.
 *   - DEV vs PROD URL collision refusal.
 *
 * Usage:
 *   npx tsx scripts/backfill-haylo-topic.ts --persona=texitie            # dry run, dev
 *   npx tsx scripts/backfill-haylo-topic.ts --persona=texitie --confirm  # write, dev
 *   npx tsx scripts/backfill-haylo-topic.ts --persona=texitie --prod --confirm   # write, prod
 */

import pg from "pg";
import { slugifyHaylo } from "../lib/haylo/ingest";

const args = process.argv.slice(2);
const FLAGS = new Set(args.filter((a) => !a.includes("=")));
const KV = new Map<string, string>(
  args
    .filter((a) => a.includes("="))
    .map((a) => {
      const i = a.indexOf("=");
      return [a.slice(0, i), a.slice(i + 1)];
    }),
);

const IS_PROD = FLAGS.has("--prod");
const CONFIRM = FLAGS.has("--confirm");
const PERSONA = (KV.get("--persona") ?? "tableicity").trim();
const SOURCE = (KV.get("--source") ?? "halo_api").trim();
const LIMIT = KV.has("--limit") ? Number(KV.get("--limit")) : null;

if (!/^[a-z0-9_]+$/.test(PERSONA)) {
  console.error(`Invalid --persona '${PERSONA}'. Allowed: lowercase letters, digits, underscore.`);
  process.exit(1);
}

const TENANT_SCHEMA = `tenant_${PERSONA}`;
const AUDIT_ACTOR = "script:backfill-haylo-topic";

const DEV_URL = process.env.DATABASE_URL;
const PROD_URL = process.env.PROD_DATABASE_URL;
const DB_URL = IS_PROD ? PROD_URL : DEV_URL;

if (!DB_URL) {
  console.error(`Missing ${IS_PROD ? "PROD_DATABASE_URL" : "DATABASE_URL"}.`);
  process.exit(1);
}
if (IS_PROD && DEV_URL && PROD_URL && DEV_URL === PROD_URL) {
  console.error("DEV_URL and PROD_URL are identical — refusing to run.");
  process.exit(1);
}

interface Row {
  id: string;
  title: string;
  slug: string;
  topic_slug: string | null;
  status: string;
}

async function main(): Promise<void> {
  console.log("=== Haylo topic-slug backfill ===");
  console.log(`Persona: ${PERSONA}  (schema ${TENANT_SCHEMA})`);
  console.log(`Source:  ${SOURCE}`);
  console.log(`Target:  ${IS_PROD ? "PROD" : "DEV"} database`);
  console.log(`Mode:    ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN"}`);
  if (LIMIT) console.log(`Limit:   ${LIMIT} candidate(s)`);
  console.log("");

  const pool = new pg.Pool({
    connectionString: DB_URL,
    ssl: DB_URL!.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 4,
  });

  try {
    const { rows } = await pool.query<Row>(
      `SELECT id, title, slug, topic_slug, status
       FROM ${TENANT_SCHEMA}.haylo_articles
       WHERE source = $1
         AND (topic_slug IS NULL OR topic_slug = '')
       ORDER BY created_at NULLS LAST, title`,
      [SOURCE],
    );

    let candidates = rows;
    if (LIMIT && candidates.length > LIMIT) candidates = candidates.slice(0, LIMIT);
    console.log(`Rows with empty topic (source='${SOURCE}'): ${rows.length}`);
    if (LIMIT) console.log(`Working set (after --limit): ${candidates.length}`);
    console.log("");

    if (candidates.length === 0) {
      console.log("Nothing to backfill. Done.");
      return;
    }

    const plans = candidates.map((r) => ({
      row: r,
      newTopic: slugifyHaylo(r.title, "general"),
    }));

    for (const p of plans) {
      console.log(`  ${p.row.slug}`);
      console.log(`     title : ${p.row.title}`);
      console.log(`     topic : (empty) -> ${p.newTopic}`);
    }
    console.log("");

    if (!CONFIRM) {
      console.log("Dry run complete. No writes performed. Re-run with --confirm to apply.");
      return;
    }

    console.log("Applying writes inside a transaction...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let written = 0;
      for (const p of plans) {
        // Forward-only guard re-checked at write time: only fill if still empty.
        const { rowCount } = await client.query(
          `UPDATE ${TENANT_SCHEMA}.haylo_articles
           SET topic_slug = $1
           WHERE id = $2
             AND (topic_slug IS NULL OR topic_slug = '')`,
          [p.newTopic, p.row.id],
        );
        if ((rowCount ?? 0) > 0) {
          written += rowCount ?? 0;
          await client.query(
            `INSERT INTO ${TENANT_SCHEMA}.admin_audit_log
               (admin_username, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              AUDIT_ACTOR,
              "haylo.topic.backfilled",
              "haylo_article",
              p.row.id,
              JSON.stringify({ slug: p.row.slug, topicSlug: p.newTopic, source: SOURCE }),
            ],
          );
        }
      }
      await client.query("COMMIT");
      console.log(`OK. Filled topic_slug on ${written} row(s) in ${TENANT_SCHEMA}.haylo_articles.`);
      console.log("Status was NOT changed — promote Draft→Ready separately.");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Write failed — transaction rolled back.", err);
      process.exit(3);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

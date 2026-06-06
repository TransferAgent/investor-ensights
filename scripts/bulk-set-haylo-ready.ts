/**
 * bulk-set-haylo-ready.ts
 *
 * Promote Draft Haylo essays to Ready in bulk — the script form of a
 * "Mark all Ready" action. Mirrors the gate the Library edit form enforces
 * (app/admin/haylo/page.tsx): an essay may only go Ready if it has a Title,
 * a Topic Slug, AND body HTML. Essays missing any of those are SKIPPED, never
 * force-promoted.
 *
 * Use case: after scripts/backfill-haylo-topic.ts fills topic_slug on
 * API-imported essays, this flips the now-complete drafts to Ready so they
 * show up in Content Studio. Status is the ONLY column it touches.
 *
 * Safety:
 *   - Only rows currently status='draft' that pass the full Ready gate.
 *   - Scoped to source='halo_api' by default (override with --source).
 *   - Dry-run by default. `--confirm` writes, inside ONE transaction + audit.
 *   - DEV vs PROD URL collision refusal.
 *
 * Usage:
 *   npx tsx scripts/bulk-set-haylo-ready.ts --persona=texitie             # dry run, dev
 *   npx tsx scripts/bulk-set-haylo-ready.ts --persona=texitie --prod      # dry run, prod
 *   npx tsx scripts/bulk-set-haylo-ready.ts --persona=texitie --prod --confirm   # write, prod
 */

import pg from "pg";

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
const AUDIT_ACTOR = "script:bulk-set-haylo-ready";

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
}

async function main(): Promise<void> {
  console.log("=== Haylo bulk set-Ready ===");
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

  // Full Ready gate, mirroring the Library edit form: title + topic + body.
  const GATE = `status = 'draft'
    AND source = $1
    AND title IS NOT NULL AND title <> ''
    AND topic_slug IS NOT NULL AND topic_slug <> ''
    AND body_html IS NOT NULL AND body_html <> ''`;

  try {
    const { rows } = await pool.query<Row>(
      `SELECT id, title, slug
       FROM ${TENANT_SCHEMA}.haylo_articles
       WHERE ${GATE}
       ORDER BY created_at NULLS LAST, title`,
      [SOURCE],
    );

    // Also report drafts that DON'T pass the gate, so skips are visible.
    const { rows: blocked } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM ${TENANT_SCHEMA}.haylo_articles
       WHERE status='draft' AND source=$1
         AND NOT (title IS NOT NULL AND title <> ''
                  AND topic_slug IS NOT NULL AND topic_slug <> ''
                  AND body_html IS NOT NULL AND body_html <> '')`,
      [SOURCE],
    );

    let candidates = rows;
    if (LIMIT && candidates.length > LIMIT) candidates = candidates.slice(0, LIMIT);
    console.log(`Drafts eligible for Ready (pass gate): ${rows.length}`);
    console.log(`Drafts blocked (missing title/topic/body): ${blocked[0]?.count ?? 0}`);
    if (LIMIT) console.log(`Working set (after --limit): ${candidates.length}`);
    console.log("");

    if (candidates.length === 0) {
      console.log("Nothing to promote. Done.");
      return;
    }

    for (const r of candidates) console.log(`  ${r.slug}  —  ${r.title}`);
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
      for (const r of candidates) {
        // Re-check the full gate at write time so a row that changed since the
        // read can't slip through.
        const { rowCount } = await client.query(
          `UPDATE ${TENANT_SCHEMA}.haylo_articles
           SET status = 'ready'
           WHERE id = $2 AND ${GATE}`,
          [SOURCE, r.id],
        );
        if ((rowCount ?? 0) > 0) {
          written += rowCount ?? 0;
          await client.query(
            `INSERT INTO ${TENANT_SCHEMA}.admin_audit_log
               (admin_username, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              AUDIT_ACTOR,
              "haylo.status.bulk_ready",
              "haylo_article",
              r.id,
              JSON.stringify({ slug: r.slug, from: "draft", to: "ready", source: SOURCE }),
            ],
          );
        }
      }
      await client.query("COMMIT");
      console.log(`OK. Promoted ${written} essay(s) to Ready in ${TENANT_SCHEMA}.haylo_articles.`);
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

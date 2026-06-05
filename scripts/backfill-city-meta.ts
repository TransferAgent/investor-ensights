/**
 * backfill-city-meta.ts (MT-City-Meta G4)
 *
 * Per-persona backfill of `meta_title` / `meta_description` for a tenant's
 * `city_locations`, using the RAG-grounded City Meta generator
 * (`lib/cities/cityMetaGenerator.ts`). Description-first, then title; the
 * generator is COMPUTE-ONLY and never throws — this script owns all writes.
 *
 * Locked decisions (Conductor spec + replit.md gotchas):
 *   - Truth doc = `public.tenants.default_haylo_article_id` → a row in the
 *     tenant's own `haylo_articles`. NO truth doc ⇒ NOTHING is written; the
 *     render-time fallback keeps serving city meta unchanged.
 *   - Generated rows are stamped `meta_source = 'llm'`. The generator never
 *     emits 'fallback' here — a city that can't be generated cleanly is SKIPPED
 *     (left untouched), never written with a degraded value.
 *   - Overwrite policy: only rows where `meta_source IS NULL OR = 'fallback'`
 *     are eligible. NEVER 'manual', NEVER a locked row (`meta_locked_at`).
 *     `--force` additionally re-generates existing 'llm' rows, but STILL
 *     refuses 'manual' and locked rows.
 *   - Forward-only: only ever UPDATEs the two meta columns + `meta_source`.
 *     Never touches `updated_at`, `slug`, `is_published`, `allow_indexing`,
 *     etc., so the public sitemap last-mod stays content-driven.
 *   - Dry-run by default. `--confirm` writes. All writes + per-city audit rows
 *     happen inside ONE transaction; any error rolls the whole run back.
 *
 * Usage:
 *   npx tsx scripts/backfill-city-meta.ts                          # dry run, dev, tableicity
 *   npx tsx scripts/backfill-city-meta.ts --confirm                # write, dev
 *   npx tsx scripts/backfill-city-meta.ts --persona=acme           # other tenant
 *   npx tsx scripts/backfill-city-meta.ts --city=austin-tx --confirm   # single city
 *   npx tsx scripts/backfill-city-meta.ts --limit=5                # cap candidates (testing)
 *   npx tsx scripts/backfill-city-meta.ts --prod --confirm         # write, prod (USER runs this)
 *   npx tsx scripts/backfill-city-meta.ts --confirm --force        # also re-gen existing 'llm' rows
 *
 * Safety:
 *   - DEV vs PROD URL collision refusal.
 *   - Generator runs BEFORE the transaction opens (LLM latency out of the tx);
 *     only the fast UPDATEs + audit inserts run inside BEGIN/COMMIT.
 */

import pg from "pg";
import type { BrandContext } from "../lib/newsroom/brandContext";
import { generateCityMeta } from "../lib/cities/cityMetaGenerator";

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
const FORCE = FLAGS.has("--force");
const PERSONA = (KV.get("--persona") ?? "tableicity").trim();
const ONLY_CITY = KV.get("--city")?.trim() || null;
const LIMIT = KV.has("--limit") ? Number(KV.get("--limit")) : null;

// Persona becomes a raw SQL identifier (`tenant_<persona>`), so it MUST be a
// safe slug — no quoting can make arbitrary input safe inside an identifier.
if (!/^[a-z0-9_]+$/.test(PERSONA)) {
  console.error(`Invalid --persona '${PERSONA}'. Allowed: lowercase letters, digits, underscore.`);
  process.exit(1);
}

const TENANT_SCHEMA = `tenant_${PERSONA}`;
const AUDIT_ACTOR = "script:backfill-city-meta";

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

interface CityRow {
  id: string;
  slug: string;
  city_name: string;
  state_code: string;
  meta_source: string | null;
  meta_locked_at: Date | null;
}

interface HayloRow {
  id: string;
  title: string;
  body_html: string;
}

async function loadBrandContext(pool: pg.Pool): Promise<BrandContext> {
  const { rows } = await pool.query(
    `SELECT slug, persona_display_name, publisher_name, author_name,
            brand_vertical, brand_tagline, brand_feature_cta, brand_home_url
     FROM public.tenants
     WHERE slug = $1
     LIMIT 1`,
    [PERSONA],
  );
  if (rows.length === 0) throw new Error(`No tenants row for slug='${PERSONA}'.`);
  const r = rows[0];
  const persona = (r.persona_display_name as string | null) || PERSONA;
  return {
    slug: r.slug,
    personaDisplayName: persona,
    publisherName: r.publisher_name || persona,
    authorName: r.author_name || `${persona} Newsroom`,
    brandVertical: r.brand_vertical || "local market intelligence",
    brandTagline: r.brand_tagline || `${persona} insights for founders and investors`,
    brandFeatureCta: r.brand_feature_cta || `${persona} guidance`,
    brandHomeUrl: r.brand_home_url ?? null,
  };
}

async function loadTruthDoc(pool: pg.Pool): Promise<HayloRow | null> {
  const { rows: tenantRows } = await pool.query(
    `SELECT default_haylo_article_id FROM public.tenants WHERE slug = $1 LIMIT 1`,
    [PERSONA],
  );
  const docId = tenantRows[0]?.default_haylo_article_id as string | null | undefined;
  if (!docId) return null;
  const { rows } = await pool.query<HayloRow>(
    `SELECT id, title, body_html FROM ${TENANT_SCHEMA}.haylo_articles WHERE id = $1 LIMIT 1`,
    [docId],
  );
  return rows[0] ?? null;
}

function eligible(c: CityRow): boolean {
  if (c.meta_locked_at) return false; // never touch a locked row
  if (c.meta_source === "manual") return false; // never overwrite human curation
  if (c.meta_source === "llm") return FORCE; // only re-gen 'llm' under --force
  // NULL or 'fallback' → eligible
  return c.meta_source === null || c.meta_source === "fallback";
}

interface Plan {
  city: CityRow;
  title: string;
  description: string;
  costUsd: number;
}

async function main(): Promise<void> {
  console.log("=== MT-City-Meta G4 — City meta backfill ===");
  console.log(`Persona: ${PERSONA}  (schema ${TENANT_SCHEMA})`);
  console.log(`Target:  ${IS_PROD ? "PROD" : "DEV"} database`);
  console.log(`Mode:    ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN"}`);
  console.log(`Force:   ${FORCE ? "YES (also re-gen existing 'llm' rows)" : "no (skip 'llm'/'manual'/locked)"}`);
  if (ONLY_CITY) console.log(`Scope:   single city slug='${ONLY_CITY}'`);
  if (LIMIT) console.log(`Limit:   ${LIMIT} candidate(s)`);
  console.log("");

  const pool = new pg.Pool({
    connectionString: DB_URL,
    ssl: DB_URL!.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 4,
  });

  try {
    const brand = await loadBrandContext(pool);
    console.log(`Brand resolved: persona="${brand.personaDisplayName}", tagline="${brand.brandTagline}"`);

    const truthDoc = await loadTruthDoc(pool);
    if (!truthDoc) {
      console.error(
        `\nNo truth document for persona '${PERSONA}' ` +
          `(public.tenants.default_haylo_article_id is unset or points to a missing row).\n` +
          `Per spec: no truth doc ⇒ no write. The render-time fallback keeps serving city meta. Nothing to do.`,
      );
      return;
    }
    console.log(`Truth doc: "${truthDoc.title}" (${truthDoc.body_html?.length ?? 0} chars body)`);
    console.log("");

    // 1) Load candidate cities.
    const params: unknown[] = [];
    let where = "";
    if (ONLY_CITY) {
      where = "WHERE slug = $1";
      params.push(ONLY_CITY);
    }
    const { rows: cities } = await pool.query<CityRow>(
      `SELECT id, slug, city_name, state_code, meta_source, meta_locked_at
       FROM ${TENANT_SCHEMA}.city_locations
       ${where}
       ORDER BY display_order, city_name`,
      params,
    );
    console.log(`Cities in scope: ${cities.length}`);

    let candidates = cities.filter(eligible);
    const skippedIneligible = cities.length - candidates.length;
    if (LIMIT && candidates.length > LIMIT) candidates = candidates.slice(0, LIMIT);
    console.log(`Eligible (NULL/'fallback'${FORCE ? "/'llm'" : ""}): ${candidates.length}  |  skipped ineligible: ${skippedIneligible}`);
    console.log("");

    if (candidates.length === 0) {
      console.log("Nothing eligible. Done.");
      return;
    }

    // 2) Generate (LLM) OUTSIDE the transaction.
    const plans: Plan[] = [];
    const failures: { slug: string; reason: string | null; status: string }[] = [];
    let totalCost = 0;
    for (const c of candidates) {
      const r = await generateCityMeta({
        brand,
        cityName: c.city_name,
        stateCode: c.state_code,
        truthDocTitle: truthDoc.title,
        truthDocBody: truthDoc.body_html,
      });
      totalCost += r.costUsd;
      if (r.status === "generated" && r.title && r.description) {
        plans.push({ city: c, title: r.title, description: r.description, costUsd: r.costUsd });
        console.log(`  OK    ${c.slug}`);
        console.log(`          T(${r.title.length}): ${r.title}`);
        console.log(`          D(${r.description.length}): ${r.description}`);
      } else {
        failures.push({ slug: c.slug, reason: r.rejectionReason, status: r.status });
        console.log(`  SKIP  ${c.slug}  [${r.status}] ${r.rejectionReason ?? ""}`);
      }
    }

    console.log("");
    console.log("Plan:");
    console.log(`  generated (writable): ${plans.length}`);
    console.log(`  skipped (gen failed): ${failures.length}`);
    console.log(`  OpenAI cost so far:   $${totalCost.toFixed(4)}`);
    if (failures.length > 0) {
      const byReason = failures.reduce<Record<string, number>>((acc, f) => {
        const k = `${f.status}:${f.reason ?? ""}`;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      console.log("  skip breakdown:");
      for (const [k, v] of Object.entries(byReason)) console.log(`    ${k.padEnd(28)} ${v}`);
    }

    if (!CONFIRM) {
      console.log("\nDry run complete. No writes performed. Re-run with --confirm to apply.");
      return;
    }
    if (plans.length === 0) {
      console.log("\nNothing generated cleanly. No writes. Done.");
      return;
    }

    // 3) Transactional write + per-city audit. The WHERE clause re-checks the
    //    overwrite guard so a row that changed since the read (locked/manual)
    //    is still protected at write time.
    console.log("\nApplying writes inside a transaction...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let written = 0;
      for (const p of plans) {
        const { rowCount } = await client.query(
          // Write-time guard is an EXACT mirror of eligible() above (positive
          // whitelist, not a blocklist) so a row that changed since the read
          // can never slip through: only NULL/'fallback' (always) or 'llm'
          // (only under --force) are writable; 'manual' and locked never are.
          `UPDATE ${TENANT_SCHEMA}.city_locations
           SET meta_title = $1,
               meta_description = $2,
               meta_source = 'llm'
           WHERE id = $3
             AND meta_locked_at IS NULL
             AND (
               meta_source IS NULL
               OR meta_source = 'fallback'
               OR ($4::boolean AND meta_source = 'llm')
             )`,
          [p.title, p.description, p.city.id, FORCE],
        );
        if ((rowCount ?? 0) > 0) {
          written += rowCount ?? 0;
          await client.query(
            `INSERT INTO ${TENANT_SCHEMA}.admin_audit_log
               (admin_username, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              AUDIT_ACTOR,
              "city.meta.generated",
              "city_location",
              p.city.id,
              JSON.stringify({
                slug: p.city.slug,
                metaSource: "llm",
                titleLength: p.title.length,
                descriptionLength: p.description.length,
                costUsd: p.costUsd,
                force: FORCE,
              }),
            ],
          );
        }
      }
      await client.query("COMMIT");
      console.log(`OK. Wrote ${written} row(s) in ${TENANT_SCHEMA}.city_locations (meta_source='llm').`);
      console.log(`Total OpenAI cost: $${totalCost.toFixed(4)}`);
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

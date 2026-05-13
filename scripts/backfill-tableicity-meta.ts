/**
 * backfill-tableicity-meta.ts (MT-4.12.7)
 *
 * One-shot backfill of `meta_title` / `meta_description` for the 84 published
 * Tableicity articles. Uses the deterministic Tier-2 builders from
 * `lib/newsroom/pairProcessor` so the same brand+city formatting that ships
 * for new pairs also applies to legacy rows.
 *
 * Locked decisions (replit.md / John gate notes):
 *   - Backfill scope = the 84 published Tableicity articles only.
 *   - Source stamp on every backfilled row = `fallback` (deterministic Tier-2).
 *   - `meta_locked_at` is set to the backfill-run wall-clock time so legacy
 *     rows are immediately frozen and can never be regenerated.
 *   - Forward-only: this script never DELETES anything; it only UPDATEs rows
 *     where `meta_locked_at IS NULL`. `--force` re-locks already-locked rows
 *     (Conductor-only escape hatch; off by default).
 *
 * Usage:
 *   npx tsx scripts/backfill-tableicity-meta.ts                    # dry run, dev DB
 *   npx tsx scripts/backfill-tableicity-meta.ts --confirm          # write to dev DB
 *   npx tsx scripts/backfill-tableicity-meta.ts --prod             # dry run, prod DB
 *   npx tsx scripts/backfill-tableicity-meta.ts --prod --confirm   # write to prod DB
 *   npx tsx scripts/backfill-tableicity-meta.ts --confirm --force  # re-stamp locked rows
 *
 * Safety:
 *   - DEV vs PROD URL refusal if they collide.
 *   - All writes inside a single transaction; rolls back on any error.
 *   - Sanity canary: refuses to write if the candidate set drifts too far
 *     from the expected 84 (configurable via --expected=N).
 */

import pg from "pg";
import { buildMetaTitle, buildMetaDescription } from "../lib/newsroom/pairProcessor";
import type { BrandContext } from "../lib/newsroom/brandContext";

const TENANT_SLUG = "tableicity";
const TENANT_SCHEMA = `tenant_${TENANT_SLUG}`;
const DEFAULT_EXPECTED = 84;

const args = process.argv.slice(2);
const FLAGS = new Set(args.filter((a) => !a.includes("=")));
const KV = new Map<string, string>(
  args.filter((a) => a.includes("=")).map((a) => {
    const i = a.indexOf("=");
    return [a.slice(0, i), a.slice(i + 1)];
  }),
);

const IS_PROD = FLAGS.has("--prod");
const CONFIRM = FLAGS.has("--confirm");
const FORCE = FLAGS.has("--force");
const EXPECTED = Number(KV.get("--expected") ?? DEFAULT_EXPECTED);

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

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  city_slug: string | null;
  haylo_article_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_source: string | null;
  meta_locked_at: Date | null;
}

interface CityRow {
  slug: string;
  city_name: string;
  state_code: string;
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
    [TENANT_SLUG],
  );
  if (rows.length === 0) {
    throw new Error(`No tenants row for slug='${TENANT_SLUG}'.`);
  }
  const r = rows[0];
  const persona = (r.persona_display_name as string | null) || "Tableicity";
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

async function main(): Promise<void> {
  console.log("=== MT-4.12.7 Tableicity meta backfill ===");
  console.log(`Target: ${IS_PROD ? "PROD" : "DEV"} database`);
  console.log(`Schema: ${TENANT_SCHEMA}`);
  console.log(`Mode:   ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN"}`);
  console.log(`Force:  ${FORCE ? "YES (re-stamp locked rows)" : "no (skip locked)"}`);
  console.log(`Canary: expect ${EXPECTED} candidate rows (override with --expected=N)`);
  console.log("");

  const pool = new pg.Pool({
    connectionString: DB_URL,
    ssl: DB_URL!.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 4,
  });

  try {
    const brand = await loadBrandContext(pool);
    console.log(`Brand resolved: persona="${brand.personaDisplayName}", tagline="${brand.brandTagline}"`);
    console.log("");

    // 1) Pull every published Tableicity article. Filter "needs backfill" in JS
    //    so the canary count matches the published universe (84) regardless of
    //    how many already happen to be locked.
    const { rows: articles } = await pool.query<ArticleRow>(
      `SELECT id, slug, title, city_slug, haylo_article_id,
              meta_title, meta_description, meta_source, meta_locked_at
       FROM ${TENANT_SCHEMA}.knowledge_articles
       WHERE status = 'published'
       ORDER BY slug`,
    );
    console.log(`Published articles in ${TENANT_SCHEMA}: ${articles.length}`);
    if (Math.abs(articles.length - EXPECTED) > 5) {
      console.error(
        `Canary tripwire: published count ${articles.length} differs from expected ${EXPECTED} by >5. Aborting. ` +
        `Pass --expected=${articles.length} to override.`,
      );
      process.exit(2);
    }

    // 2) Bulk-load referenced cities + haylo articles.
    const citySlugs = Array.from(new Set(articles.map((a) => a.city_slug).filter(Boolean) as string[]));
    const hayloIds = Array.from(new Set(articles.map((a) => a.haylo_article_id).filter(Boolean) as string[]));

    const cityMap = new Map<string, CityRow>();
    if (citySlugs.length > 0) {
      const { rows } = await pool.query<CityRow>(
        `SELECT slug, city_name, state_code
         FROM ${TENANT_SCHEMA}.city_locations
         WHERE slug = ANY($1)`,
        [citySlugs],
      );
      for (const r of rows) cityMap.set(r.slug, r);
    }

    const hayloMap = new Map<string, HayloRow>();
    if (hayloIds.length > 0) {
      const { rows } = await pool.query<HayloRow>(
        `SELECT id, title, body_html
         FROM ${TENANT_SCHEMA}.haylo_articles
         WHERE id = ANY($1)`,
        [hayloIds],
      );
      for (const r of rows) hayloMap.set(r.id, r);
    }

    // 3) Build per-row plan.
    const now = new Date();
    interface Plan {
      id: string;
      slug: string;
      reason: "backfill" | "force-relock" | "skip-locked" | "skip-no-city" | "skip-already-set";
      newMetaTitle: string | null;
      newMetaDescription: string | null;
    }
    const plans: Plan[] = [];

    for (const a of articles) {
      if (a.meta_locked_at && !FORCE) {
        plans.push({ id: a.id, slug: a.slug, reason: "skip-locked", newMetaTitle: null, newMetaDescription: null });
        continue;
      }
      if (!a.city_slug) {
        plans.push({ id: a.id, slug: a.slug, reason: "skip-no-city", newMetaTitle: null, newMetaDescription: null });
        continue;
      }
      const city = cityMap.get(a.city_slug);
      if (!city) {
        plans.push({ id: a.id, slug: a.slug, reason: "skip-no-city", newMetaTitle: null, newMetaDescription: null });
        continue;
      }
      const haylo = a.haylo_article_id ? hayloMap.get(a.haylo_article_id) : null;
      // Fall back to the article title when the legacy article isn't paired
      // to a Halo essay (some of the 80 manual rows pre-date the pairing).
      const hayloTitle = haylo?.title ?? a.title ?? "";
      const hayloBody = haylo?.body_html;

      const newMetaTitle = buildMetaTitle(brand, city.city_name, city.state_code, hayloTitle);
      const newMetaDescription = buildMetaDescription(brand, city.city_name, city.state_code, hayloTitle, hayloBody);

      plans.push({
        id: a.id,
        slug: a.slug,
        reason: a.meta_locked_at ? "force-relock" : "backfill",
        newMetaTitle,
        newMetaDescription,
      });
    }

    // 4) Summarize.
    const counts = plans.reduce<Record<string, number>>((acc, p) => {
      acc[p.reason] = (acc[p.reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log("");
    console.log("Plan:");
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);

    const writable = plans.filter((p) => p.reason === "backfill" || p.reason === "force-relock");
    console.log(`\nWritable rows: ${writable.length}`);

    if (writable.length > 0) {
      console.log("\nSample (first 5):");
      for (const p of writable.slice(0, 5)) {
        console.log(`  - ${p.slug}`);
        console.log(`      title (${p.newMetaTitle?.length}): ${p.newMetaTitle}`);
        console.log(`      desc  (${p.newMetaDescription?.length}): ${p.newMetaDescription}`);
      }
    }

    if (!CONFIRM) {
      console.log("\nDry run complete. No writes performed. Re-run with --confirm to apply.");
      return;
    }
    if (writable.length === 0) {
      console.log("\nNothing to write. Done.");
      return;
    }

    // 5) Transactional write. Stamp meta_source='fallback', meta_generated_at
    //    and meta_locked_at to `now` per locked decision.
    console.log("\nApplying writes inside a transaction...");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let written = 0;
      for (const p of writable) {
        const { rowCount } = await client.query(
          `UPDATE ${TENANT_SCHEMA}.knowledge_articles
           SET meta_title = $1,
               meta_description = $2,
               meta_source = 'fallback',
               meta_generated_at = $3,
               meta_locked_at = $3,
               updated_at = $3
           WHERE id = $4
             AND ($5::boolean OR meta_locked_at IS NULL)`,
          [p.newMetaTitle, p.newMetaDescription, now, p.id, FORCE],
        );
        written += rowCount ?? 0;
      }
      await client.query("COMMIT");
      console.log(`OK. Wrote ${written} row(s) in ${TENANT_SCHEMA}.knowledge_articles.`);
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

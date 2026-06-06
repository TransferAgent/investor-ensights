/**
 * THROWAWAY diagnostic — delete after run.
 * Picks 3 texitie city+Haylo pairs from PROD (read-only) and runs the EXACT
 * deployed naturalizer over their real inputs. No PROD writes.
 */
import pgmod from "pg";
const { Client } = pgmod;
import { naturalizeMeta, hayloBodyExcerptFromHtml } from "../lib/newsroom/metaNaturalizer";
import { buildMetaTitle, buildMetaDescription } from "../lib/newsroom/pairProcessor";
import type { BrandContext } from "../lib/newsroom/brandContext";

const SLUG = "texitie";

function defaultsFor(slug: string, personaDisplayName?: string | null): BrandContext {
  const persona = (personaDisplayName ?? slug).trim() || slug;
  return {
    slug,
    personaDisplayName: persona,
    publisherName: persona,
    authorName: persona,
    brandVertical: "local market intelligence",
    brandTagline: `${persona} insights for founders and investors`,
    brandFeatureCta: `${persona} guidance`,
    brandHomeUrl: null,
  } as BrandContext;
}

async function main() {
  const c = new Client({ connectionString: process.env.PROD_DATABASE_URL });
  await c.connect();

  // 1. Brand (mirror resolveBrandContext merge)
  const t = await c.query(
    `SELECT slug, persona_display_name, publisher_name, author_name,
            brand_vertical, brand_tagline, brand_feature_cta, brand_home_url
     FROM public.tenants WHERE slug=$1 LIMIT 1`,
    [SLUG],
  );
  const row = t.rows[0];
  const fb = defaultsFor(SLUG, row?.persona_display_name);
  const brand: BrandContext = {
    slug: row.slug,
    personaDisplayName: row.persona_display_name || fb.personaDisplayName,
    publisherName: row.publisher_name || fb.publisherName,
    authorName: row.author_name || fb.authorName,
    brandVertical: (row.brand_vertical || "").trim() || fb.brandVertical,
    brandTagline: (row.brand_tagline || "").trim() || fb.brandTagline,
    brandFeatureCta: (row.brand_feature_cta || "").trim() || fb.brandFeatureCta,
    brandHomeUrl: row.brand_home_url ?? null,
  } as BrandContext;
  console.log(`Brand: persona="${brand.personaDisplayName}" vertical="${brand.brandVertical}"`);

  // 2. Candidate cities (exclude the 3 already-published glue articles)
  const cities = await c.query(
    `SELECT city_name, state_code, slug FROM tenant_texitie.city_locations
     WHERE lower(city_name) NOT IN ('abilene','albany','akron')
     ORDER BY city_name LIMIT 20`,
  );
  // 3. Haylo essays with real bodies
  const haylo = await c.query(
    `SELECT id, title, body_html FROM tenant_texitie.haylo_articles
     WHERE status='published' AND body_html IS NOT NULL AND length(body_html) > 1500
     ORDER BY created_at LIMIT 8`,
  );
  await c.end();

  if (cities.rows.length < 3 || haylo.rows.length < 1) {
    console.error(`Not enough inputs: ${cities.rows.length} cities, ${haylo.rows.length} haylo`);
    process.exit(1);
  }

  // 4. Pick 3 distinct cities; rotate Haylo topics for variety
  const picks = [0, 1, 2].map((i) => ({
    city: cities.rows[i],
    haylo: haylo.rows[i % haylo.rows.length],
  }));

  let total = 0;
  for (let i = 0; i < picks.length; i++) {
    const { city, haylo: h } = picks[i];
    const cityName = city.city_name as string;
    const stateCode = city.state_code as string;
    const hayloTitle = h.title as string;
    const bodyHtml = h.body_html as string;

    const fallbackTitle = buildMetaTitle(brand, cityName, stateCode, hayloTitle);
    const fallbackDescription = buildMetaDescription(brand, cityName, stateCode, hayloTitle, bodyHtml);

    const r = await naturalizeMeta({
      brand,
      cityName,
      stateCode,
      hayloTitle,
      hayloBodyExcerpt: hayloBodyExcerptFromHtml(bodyHtml, 4000),
      fallbackTitle,
      fallbackDescription,
    });
    total += r.costUsd;

    console.log(`\n========== ARTICLE ${i + 1}/3 — ${cityName}, ${stateCode} ==========`);
    console.log(`Haylo topic: "${hayloTitle}"`);
    console.log(`RESULT: source=${r.source}  reason=${r.rejectionReason ?? "—"}  cost=$${r.costUsd.toFixed(6)}`);
    console.log(`  TITLE (${r.title.length}): ${r.title}`);
    console.log(`  DESC  (${r.description.length}): ${r.description}`);
  }
  console.log(`\nTOTAL cost for 3 articles: $${total.toFixed(6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * THROWAWAY proof — read-only. Pulls REAL production article bodies and runs the
 * new generator (lib/newsroom/articleMetaGenerator.ts) on them, printing the
 * existing meta (old) vs the freshly generated meta (new) with char counts.
 * Writes NOTHING. Delete after the Conductor has seen the proof.
 *
 * Usage:  npx tsx scripts/prove-article-meta.ts texitie:1 tableicity:2
 *         (defaults to "texitie:1 tableicity:2" — 3 real articles)
 */
import pg from "pg";
const { Client } = pg;
import { generateArticleMeta } from "../lib/newsroom/articleMetaGenerator";

interface Brand {
  personaDisplayName: string;
  brandVertical?: string;
  brandTagline?: string;
}

async function brandFor(c: pg.Client, slug: string): Promise<Brand> {
  const r = await c.query(
    `SELECT persona_display_name, brand_vertical, brand_tagline FROM public.tenants WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const row = r.rows[0] ?? {};
  return {
    personaDisplayName: row.persona_display_name || slug,
    brandVertical: row.brand_vertical || undefined,
    brandTagline: row.brand_tagline || undefined,
  };
}

async function cityNameFor(c: pg.Client, slug: string, citySlug: string | null): Promise<string | null> {
  if (!citySlug) return null;
  try {
    const r = await c.query(
      `SELECT city_name FROM tenant_${slug}.city_locations WHERE slug = $1 LIMIT 1`,
      [citySlug],
    );
    return r.rows[0]?.city_name ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const pairs = (process.argv.slice(2).length ? process.argv.slice(2) : ["texitie:1", "tableicity:2"]).map((p) => {
    const [slug, n] = p.split(":");
    return { slug, limit: Number(n ?? 1) };
  });

  const c = new Client({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  let totalCost = 0;
  let idx = 0;
  for (const { slug, limit } of pairs) {
    const brand = await brandFor(c, slug);
    const arts = await c.query(
      `SELECT slug, city_slug, title, meta_title, meta_description, meta_source, body_html
         FROM tenant_${slug}.knowledge_articles
         ORDER BY created_at DESC NULLS LAST
         LIMIT $1`,
      [limit],
    );
    for (const a of arts.rows) {
      idx++;
      const cityName = await cityNameFor(c, slug, a.city_slug);
      const oldTitle = a.meta_title ?? "(null)";
      const oldDesc = a.meta_description ?? "(null)";
      console.log(`\n${"=".repeat(78)}`);
      console.log(`ARTICLE #${idx}  tenant=${slug}  brand="${brand.personaDisplayName}"  city=${cityName ?? "(none)"}`);
      console.log(`slug: ${a.slug}`);
      console.log(`\n  OLD meta_source=${a.meta_source ?? "(null)"}`);
      console.log(`  OLD title (${oldTitle === "(null)" ? 0 : oldTitle.length}): ${oldTitle}`);
      console.log(`  OLD desc  (${oldDesc === "(null)" ? 0 : oldDesc.length}): ${oldDesc}`);

      const res = await generateArticleMeta({
        articleTitle: a.title,
        articleBody: a.body_html,
        cityName,
        brand,
      });
      totalCost += res.costUsd;
      console.log(`\n  NEW status=${res.status}  attempts=${res.attempts}  cost=$${res.costUsd.toFixed(5)}`);
      console.log(`  NEW title (${res.title?.length ?? 0}): ${res.title ?? "(none)"}`);
      console.log(`  NEW desc  (${res.description?.length ?? 0}): ${res.description ?? "(none)"}`);
      if (res.rejectionReason) console.log(`  NEW rejectionReason: ${res.rejectionReason}`);
    }
  }

  await c.end();
  console.log(`\n${"=".repeat(78)}`);
  console.log(`TOTAL articles: ${idx}   TOTAL OpenAI cost: $${totalCost.toFixed(5)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

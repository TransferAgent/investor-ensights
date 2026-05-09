/**
 * Protected SEO baseline — the URLs Google currently ranks.
 * Source: John/1 Google .csv (2026-04-28 snapshot, 60 ranking URLs + homepage = 61).
 *
 * Used by the safety-reverse endpoint:
 *   - POST /api/admin/seo/apply-index-baseline → flips everything IN these
 *     lists back to index (use when a slug was caught by an earlier sweep
 *     but Google has now ranked it; restores indexability). Idempotent.
 *
 * NOTE: The destructive companion endpoint (apply-noindex-baseline) was
 * deleted per Recovery_Google.md Step 1 (2026-05-09). Per-row toggles in
 * /admin/cities and /admin/knowledge are now the only way to flip
 * indexability. Re-introducing a "park-everything-to-noindex" sweeper is
 * forbidden.
 *
 * The homepage (https://www.tableicity.com/) is in the protected set but
 * is not stored in city_locations or knowledge_articles, so no DB action
 * is needed for it — it's protected by virtue of not living in those tables.
 */

export const PROTECTED_CITY_SLUGS: readonly string[] = [
  "austin-tx",
  "fremont-ca",
  "greensboro-nc",
  "kansas-city-mo",
  "madison-wi",
  "nashville-tn",
  "pittsburgh-pa",
  "port-st-lucie-fl",
  "raleigh-nc",
  "rialto-ca",
  "sacramento-ca",
  "san-antonio-tx",
  "san-diego-ca",
  "san-francisco-ca",
  "san-jose-ca",
  "santa-clarita-ca",
  "seattle-wa",
  "tempe-az",
  "tucson-az",
  "washington-dc",
] as const;

export const PROTECTED_ARTICLE_SLUGS: readonly string[] = [
  "tableicity-albuquerque-cap-table",
  "tableicity-albuquerque-zkp-noir-press-release-v1",
  "tableicity-anaheim-zkp-noir-press-release-v1",
  "tableicity-anchorage-zkp-noir-press-release-v1",
  "tableicity-arlington-zkp-noir-press-release-v1",
  "tableicity-atlanta-cap-table",
  "tableicity-atlanta-zkp-noir-press-release-v1",
  "tableicity-aurora-zkp-noir-press-release-v1",
  "tableicity-austin-cap-table",
  "tableicity-austin-zkp-noir-press-release-v1",
  "tableicity-boston-cap-table",
  "tableicity-chandler-zkp-noir-press-release-v1",
  "tableicity-colorado-springs-cap-table",
  "tableicity-corpus-christi-zkp-noir-press-release-v1",
  "tableicity-fontana-cap-table",
  "tableicity-lincoln-zkp-noir-press-release-v1",
  "tableicity-los-angeles-cap-table",
  "tableicity-los-angeles-zkp-noir-press-release-v1",
  "tableicity-madison-zkp-noir-press-release-v1",
  "tableicity-memphis-cap-table",
  "tableicity-mesa-zkp-noir-press-release-v1",
  "tableicity-miami-zkp-noir-press-release-v1",
  "tableicity-nashville-zkp-noir-press-release-v1",
  "tableicity-new-york-zkp-noir-press-release-v1",
  "tableicity-oklahoma-city-zkp-noir-press-release-v1",
  "tableicity-omaha-zkp-noir-press-release-v1",
  "tableicity-philadelphia-zkp-noir-press-release-v1",
  "tableicity-phoenix-zkp-noir-press-release-v1",
  "tableicity-plano-zkp-noir-press-release-v1",
  "tableicity-portland-zkp-noir-press-release-v1",
  "tableicity-raleigh-zkp-noir-press-release-v1",
  "tableicity-rialto-zkp-noir-press-release-v1",
  "tableicity-san-antonio-zkp-noir-press-release-v1",
  "tableicity-san-diego-zkp-noir-press-release-v1",
  "tableicity-san-francisco-zkp-noir-press-release-v1",
  "tableicity-seattle-zkp-noir-press-release-v1",
  "tableicity-st-paul-zkp-noir-press-release-v1",
  "tableicity-tempe-zkp-noir-press-release-v1",
  "tableicity-tucson-zkp-noir-press-release-v1",
  "tableicity-washington-zkp-noir-press-release-v1",
] as const;

export const NOINDEX_ROBOTS = "noindex, nofollow, noarchive, nosnippet, noimageindex";
export const INDEX_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

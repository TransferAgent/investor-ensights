/**
 * Protected SEO baseline — the 41 URLs Google currently ranks.
 * Source: John/PR DO NOT TOUCH/Do not touch B.csv (2026-04-23 snapshot).
 *
 * Everything NOT in these lists gets flipped to noindex by
 * POST /api/admin/seo/apply-noindex-baseline. The endpoint is idempotent;
 * editing this file and re-running the endpoint will adjust the baseline.
 *
 * The homepage (https://www.tableicity.com/) is in the protected set but
 * is not stored in city_locations or knowledge_articles, so no DB action
 * is needed for it — it's protected by virtue of not living in those tables.
 */

export const PROTECTED_CITY_SLUGS: readonly string[] = [
  "pittsburgh-pa",
  "madison-wi",
  "rialto-ca",
  "sacramento-ca",
  "san-antonio-tx",
  "san-diego-ca",
  "san-francisco-ca",
  "san-jose-ca",
  "seattle-wa",
  "tempe-az",
  "tucson-az",
  "washington-dc",
  "raleigh-nc",
  "nashville-tn",
  "kansas-city-mo",
  "austin-tx",
] as const;

export const PROTECTED_ARTICLE_SLUGS: readonly string[] = [
  "tableicity-phoenix-zkp-noir-press-release-v1",
  "tableicity-mesa-zkp-noir-press-release-v1",
  "tableicity-miami-zkp-noir-press-release-v1",
  "tableicity-nashville-zkp-noir-press-release-v1",
  "tableicity-oklahoma-city-zkp-noir-press-release-v1",
  "tableicity-new-york-zkp-noir-press-release-v1",
  "tableicity-omaha-zkp-noir-press-release-v1",
  "tableicity-philadelphia-zkp-noir-press-release-v1",
  "tableicity-portland-zkp-noir-press-release-v1",
  "tableicity-raleigh-zkp-noir-press-release-v1",
  "tableicity-los-angeles-zkp-noir-press-release-v1",
  "tableicity-rialto-zkp-noir-press-release-v1",
  "tableicity-san-antonio-zkp-noir-press-release-v1",
  "tableicity-san-diego-zkp-noir-press-release-v1",
  "tableicity-san-francisco-zkp-noir-press-release-v1",
  "tableicity-seattle-zkp-noir-press-release-v1",
  "tableicity-tempe-zkp-noir-press-release-v1",
  "tableicity-tucson-zkp-noir-press-release-v1",
  "tableicity-washington-zkp-noir-press-release-v1",
  "tableicity-colorado-springs-cap-table",
  "tableicity-fontana-cap-table",
  "tableicity-memphis-cap-table",
  "tableicity-boston-cap-table",
  "tableicity-los-angeles-cap-table",
] as const;

export const NOINDEX_ROBOTS = "noindex, nofollow, noarchive, nosnippet, noimageindex";

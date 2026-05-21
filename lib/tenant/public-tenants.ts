import { storage } from "@/lib/storage";
import { DEFAULT_TENANT_SLUG, withTenantAsync } from "./context";
import { getTenantPool } from "./pools";

// MT-multitenant-homepage: derived "public tenant" gate (Decision 3B from
// the Sep-2026 architecture conversation). A tenant qualifies for public
// surfaces (homepage cards, /locations + /discovery/knowledge directories,
// sitemap per-persona entries) iff it has BOTH:
//   1. ≥1 city with isPublished=true AND allow_indexing=true
//   2. ≥1 knowledge article with status='published' AND not robots:noindex
//
// The two gates are evaluated independently — they do NOT require an article
// to be assigned to a public city. That stricter join is done at card-render
// time so we can still show "this persona has cities, no recent insights yet"
// without dropping the persona off the homepage entirely.

export interface PublicTenant {
  slug: string;
  personaDisplayName: string;
  brandTagline: string | null;
  brandVertical: string | null;
  brandFeatureCta: string | null;
  brandHomeUrl: string | null;
  companyName: string | null;
}

export interface PersonaCardArticle {
  slug: string;
  title: string;
  citySlug: string;
  cityName: string;
  stateCode: string;
  datePublished: string | null;
}

export interface PersonaCardData {
  tenant: PublicTenant;
  cityCount: number;
  recentArticles: PersonaCardArticle[];
}

interface ListCacheEntry {
  tenants: PublicTenant[];
  checkedAt: number;
}

interface CardsCacheEntry {
  cards: PersonaCardData[];
  checkedAt: number;
}

let listCache: ListCacheEntry | null = null;
let cardsCache: CardsCacheEntry | null = null;
const TTL_MS = 60_000;

interface TenantRow {
  slug: string;
  personaDisplayName: string;
  brandTagline: string | null;
  brandVertical: string | null;
  brandFeatureCta: string | null;
  brandHomeUrl: string | null;
  companyName: string | null;
}

async function listAllTenants(): Promise<TenantRow[]> {
  const pool = getTenantPool(DEFAULT_TENANT_SLUG);
  const r = await pool.query<TenantRow>(
    `SELECT slug,
            persona_display_name AS "personaDisplayName",
            brand_tagline        AS "brandTagline",
            brand_vertical       AS "brandVertical",
            brand_feature_cta    AS "brandFeatureCta",
            brand_home_url       AS "brandHomeUrl",
            company_name         AS "companyName"
       FROM public.tenants
      ORDER BY created_at ASC`,
  );
  return r.rows;
}

async function tenantPassesPublicGate(slug: string): Promise<boolean> {
  try {
    return await withTenantAsync(slug, async () => {
      const cities = await storage.getCities(true);
      const hasPiCity = cities.some((c) => c.allowIndexing === true);
      if (!hasPiCity) return false;
      const articles = await storage.getKnowledgeArticles("published");
      return articles.some(
        (a) => !String(a.robots || "").toLowerCase().includes("noindex"),
      );
    });
  } catch {
    return false;
  }
}

export async function getPublicTenants(): Promise<PublicTenant[]> {
  const now = Date.now();
  if (listCache && now - listCache.checkedAt < TTL_MS) return listCache.tenants;

  let allTenants: TenantRow[] = [];
  try {
    allTenants = await listAllTenants();
  } catch {
    return listCache?.tenants ?? [];
  }

  const checks = await Promise.all(
    allTenants.map(async (t) => ({ t, ok: await tenantPassesPublicGate(t.slug) })),
  );
  const tenants: PublicTenant[] = checks.filter((c) => c.ok).map((c) => c.t);
  listCache = { tenants, checkedAt: now };
  return tenants;
}

export async function isPublicTenant(slug: string): Promise<boolean> {
  const list = await getPublicTenants();
  return list.some((t) => t.slug === slug);
}

// Build the homepage card data — one entry per public tenant, each with
// the persona's city count and 5 most-recent articles whose city is
// Publish+Index (so we never link the homepage to an article whose city
// the Conductor has flipped Draft or NoIndex).
export async function getPersonaCardData(): Promise<PersonaCardData[]> {
  const now = Date.now();
  if (cardsCache && now - cardsCache.checkedAt < TTL_MS) return cardsCache.cards;

  const tenants = await getPublicTenants();
  const cards = await Promise.all(
    tenants.map(async (t) => {
      try {
        return await withTenantAsync(t.slug, async () => {
          const [cities, articles] = await Promise.all([
            storage.getCities(true),
            storage.getKnowledgeArticles("published"),
          ]);
          const publicCities = cities.filter((c) => c.allowIndexing === true);
          const cityMap = new Map(publicCities.map((c) => [c.slug, c] as const));
          const recent: PersonaCardArticle[] = articles
            .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
            .filter((a) => a.citySlug && cityMap.has(a.citySlug))
            .sort((a, b) => {
              const ta = a.datePublished ? new Date(a.datePublished).getTime() : 0;
              const tb = b.datePublished ? new Date(b.datePublished).getTime() : 0;
              return tb - ta;
            })
            .slice(0, 5)
            .map((a) => {
              const city = cityMap.get(a.citySlug as string)!;
              return {
                slug: a.slug,
                title: a.headline || a.title,
                citySlug: city.slug,
                cityName: city.cityName,
                stateCode: city.stateCode,
                datePublished: a.datePublished ? a.datePublished.toISOString() : null,
              };
            });
          return { tenant: t, cityCount: publicCities.length, recentArticles: recent };
        });
      } catch {
        return { tenant: t, cityCount: 0, recentArticles: [] };
      }
    }),
  );

  cardsCache = { cards, checkedAt: now };
  return cards;
}

export function _resetPublicTenantsCacheForTesting() {
  listCache = null;
  cardsCache = null;
}

import { DEFAULT_TENANT_SLUG } from "./context";
import { getTenantPool } from "./pools";

let cache: { slugs: string[]; checkedAt: number } | null = null;
const TTL_MS = 60_000;

async function listTenantSlugs(): Promise<string[]> {
  const now = Date.now();
  if (cache && now - cache.checkedAt < TTL_MS) return cache.slugs;
  const pool = getTenantPool(DEFAULT_TENANT_SLUG);
  try {
    const r = await pool.query<{ slug: string }>(`SELECT slug FROM public.tenants`);
    const slugs = r.rows.map((row) => row.slug);
    cache = { slugs, checkedAt: now };
    return slugs;
  } catch {
    return cache?.slugs ?? [DEFAULT_TENANT_SLUG];
  }
}

/**
 * MT-4.5: Article URL namespace is "globally unique by construction"
 * (locked decision in replit.md): every article slug is prefixed with the
 * persona slug of the tenant that owns it. To serve any tenant's article
 * from a single public route, we look up which tenant the slug belongs to
 * by matching the longest persona prefix from `public.tenants`.
 *
 * Falls back to DEFAULT_TENANT_SLUG ("tableicity") for safety so the existing
 * 80 Tableicity articles keep resolving exactly as before, even on cold cache.
 */
export async function resolveTenantFromArticleSlug(slug: string): Promise<string> {
  const slugs = await listTenantSlugs();
  const candidates = slugs
    .filter((t) => slug === t || slug.startsWith(`${t}-`))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ?? DEFAULT_TENANT_SLUG;
}

// City slug → tenant resolution via public.city_slug_registry. Unlike article
// slugs, city slugs do NOT embed the persona prefix (they're global per the
// MT-0 decision in replit.md), so we have to consult the registry.
//
// Without this lookup, /locations/<city-slug> would always read from the
// default tenant's schema — a latent bug that becomes visible the moment a
// second persona ships its first city.
const citySlugCache = new Map<string, { tenantSlug: string; checkedAt: number }>();
const CITY_TTL_MS = 5 * 60_000;

export async function resolveTenantFromCitySlug(slug: string): Promise<string> {
  const now = Date.now();
  const cached = citySlugCache.get(slug);
  if (cached && now - cached.checkedAt < CITY_TTL_MS) return cached.tenantSlug;

  const pool = getTenantPool(DEFAULT_TENANT_SLUG);
  try {
    const r = await pool.query<{ tenant_slug: string }>(
      `SELECT tenant_slug FROM public.city_slug_registry WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const tenantSlug = r.rows[0]?.tenant_slug ?? DEFAULT_TENANT_SLUG;
    citySlugCache.set(slug, { tenantSlug, checkedAt: now });
    return tenantSlug;
  } catch {
    return cached?.tenantSlug ?? DEFAULT_TENANT_SLUG;
  }
}

export function _resetSlugResolverCacheForTesting() {
  cache = null;
  citySlugCache.clear();
}

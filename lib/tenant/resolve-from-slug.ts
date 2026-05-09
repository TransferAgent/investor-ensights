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

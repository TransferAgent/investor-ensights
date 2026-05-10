import { DEFAULT_TENANT_SLUG } from "./context";
import { getTenantPool } from "./pools";

export type TenantBranding = {
  slug: string;
  personaDisplayName: string;
  brandHomeUrl: string | null;
};

const cache = new Map<string, { value: TenantBranding | null; checkedAt: number }>();
const TTL_MS = 60_000;

/**
 * MT-4.6: read per-tenant branding (display name + brand link template) from
 * `public.tenants`. Used by the public article page to render tenant-aware
 * first-mention brand links. 60s in-memory cache keeps lookups cheap.
 */
export async function getTenantBranding(slug: string): Promise<TenantBranding | null> {
  const now = Date.now();
  const cached = cache.get(slug);
  if (cached && now - cached.checkedAt < TTL_MS) return cached.value;

  const pool = getTenantPool(DEFAULT_TENANT_SLUG);
  try {
    const r = await pool.query<{ slug: string; persona_display_name: string; brand_home_url: string | null }>(
      `SELECT slug, persona_display_name, brand_home_url FROM public.tenants WHERE slug = $1`,
      [slug],
    );
    const value = r.rows[0]
      ? {
          slug: r.rows[0].slug,
          personaDisplayName: r.rows[0].persona_display_name,
          brandHomeUrl: r.rows[0].brand_home_url,
        }
      : null;
    cache.set(slug, { value, checkedAt: now });
    return value;
  } catch {
    return cached?.value ?? null;
  }
}

/**
 * Resolve placeholders in a brand URL template:
 *   {city}     → article's full citySlug as stored in city_slug_registry
 *                (may include a `-<tenant>` suffix from global slug uniqueness)
 *   {cityCore} → citySlug with a trailing `-<tenantSlug>` suffix stripped, so
 *                external destination sites that use the un-suffixed city slug
 *                (e.g. tenant's own domain) get the right path.
 *                Falls back to the full citySlug if no suffix is present.
 *
 * If template is null or empty, returns null (caller renders plain text).
 */
export function resolveBrandHref(
  template: string | null,
  citySlug?: string | null,
  tenantSlug?: string | null,
): string | null {
  if (!template) return null;
  const full = citySlug ?? "";
  let core = full;
  if (tenantSlug && full.endsWith(`-${tenantSlug}`)) {
    core = full.slice(0, full.length - tenantSlug.length - 1);
  }
  return template
    .replace(/\{cityCore\}/g, core)
    .replace(/\{city\}/g, full);
}

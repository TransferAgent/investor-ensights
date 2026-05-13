import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_TENANT_SLUG, getCurrentTenantSlug } from "@/lib/tenant/context";

/**
 * MT-4.12: per-tenant brand voice resolved from `public.tenants`. Used by the
 * Newsroom 5-agent pipeline to parameterize prompts, meta fields, author /
 * publisher attribution, and the deterministic Tier-2 meta fallbacks.
 *
 * Resolved fields are required for the LLM to produce on-brand SEO meta; if
 * the tenants row is missing optional brand_* columns we fall back to safe
 * persona-derived strings so the pipeline never crashes for a partially
 * configured tenant.
 */
export interface BrandContext {
  slug: string;
  personaDisplayName: string;
  publisherName: string;
  authorName: string;
  brandVertical: string;
  brandTagline: string;
  brandFeatureCta: string;
  brandHomeUrl: string | null;
}

const cache = new Map<string, { value: BrandContext; checkedAt: number }>();
const TTL_MS = 60_000;

function defaultsFor(slug: string, personaDisplayName?: string | null): BrandContext {
  const persona = (personaDisplayName ?? slug).trim() || slug;
  return {
    slug,
    personaDisplayName: persona,
    publisherName: persona,
    authorName: `${persona} Newsroom`,
    brandVertical: "local market intelligence",
    brandTagline: `${persona} insights for founders and investors`,
    brandFeatureCta: `${persona} guidance`,
    brandHomeUrl: null,
  };
}

export async function resolveBrandContext(slug?: string | null): Promise<BrandContext> {
  const tenantSlug = (slug ?? getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG).trim();
  const now = Date.now();
  const cached = cache.get(tenantSlug);
  if (cached && now - cached.checkedAt < TTL_MS) return cached.value;

  let value: BrandContext;
  try {
    const [row] = await db
      .select({
        slug: tenants.slug,
        personaDisplayName: tenants.personaDisplayName,
        publisherName: tenants.publisherName,
        authorName: tenants.authorName,
        brandVertical: tenants.brandVertical,
        brandTagline: tenants.brandTagline,
        brandFeatureCta: tenants.brandFeatureCta,
        brandHomeUrl: tenants.brandHomeUrl,
      })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!row) {
      value = defaultsFor(tenantSlug);
    } else {
      const fallback = defaultsFor(tenantSlug, row.personaDisplayName);
      value = {
        slug: row.slug,
        personaDisplayName: row.personaDisplayName || fallback.personaDisplayName,
        publisherName: row.publisherName || fallback.publisherName,
        authorName: row.authorName || fallback.authorName,
        brandVertical: row.brandVertical?.trim() || fallback.brandVertical,
        brandTagline: row.brandTagline?.trim() || fallback.brandTagline,
        brandFeatureCta: row.brandFeatureCta?.trim() || fallback.brandFeatureCta,
        brandHomeUrl: row.brandHomeUrl ?? null,
      };
    }
  } catch (err) {
    console.warn(
      `[brandContext] failed to load tenants row for "${tenantSlug}", using defaults:`,
      err instanceof Error ? err.message : err,
    );
    value = cached?.value ?? defaultsFor(tenantSlug);
  }

  cache.set(tenantSlug, { value, checkedAt: now });
  return value;
}

/** Synchronous helper for code paths that have no tenant DB access (fixtures, tests). */
export function defaultBrandContext(slug: string = DEFAULT_TENANT_SLUG): BrandContext {
  return defaultsFor(slug);
}

/**
 * Strict check used by the Pair orchestrator to decide whether the LLM-produced
 * meta string can be used verbatim (Tier-1) or must be replaced by the
 * deterministic Tier-2 prefix. The LLM wins only when its string mentions
 * BOTH the persona display name AND the city name (case-insensitive).
 */
export function metaContainsBrandAndCity(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
): boolean {
  if (!meta) return false;
  const lower = meta.toLowerCase();
  const persona = brand.personaDisplayName.toLowerCase();
  const city = cityName.toLowerCase();
  return persona.length > 0 && city.length > 0 && lower.includes(persona) && lower.includes(city);
}

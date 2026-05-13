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
 * Legacy Tier-1 acceptance check (MT-4.12). Kept for callers that still need
 * the strict "both names present" gate. Most paths should use the new
 * MT-4.13.4 helpers below instead.
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

/**
 * MT-4.13.4 — Title acceptance gate.
 *
 * New contract (Conductor approved):
 *   - City MUST appear verbatim (case-insensitive).
 *   - Brand display name MUST NOT appear — Google truncates SERP titles ~60
 *     chars and the brand earns its place in the H1, canonical URL, and
 *     description; spending the title's character budget on it is wasteful.
 *   - Length ≤ `maxLen` (default 65).
 *
 * Returns null when acceptable, or a short reason string when rejected.
 */
export function metaTitleAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  maxLen: number = 65,
): string | null {
  if (!meta) return "title-empty";
  if (meta.length > maxLen) return `title-too-long-${meta.length}`;
  const lower = meta.toLowerCase();
  if (!lower.includes(cityName.toLowerCase())) return "title-missing-city";
  if (
    brand.personaDisplayName.length > 0 &&
    lower.includes(brand.personaDisplayName.toLowerCase())
  ) {
    return "title-contains-brand";
  }
  return null;
}

/**
 * MT-4.13.4 — Description acceptance gate ("80% content, 20% brand").
 *
 * New contract (Conductor approved):
 *   - City MUST appear verbatim (case-insensitive).
 *   - Brand MUST appear AT LEAST ONCE, AT MOST TWICE (case-insensitive
 *     word-boundary count). Twice is the upper bound so the snippet doesn't
 *     read as an ad.
 *   - Brand MUST NOT appear inside the first `brandLeadGuardChars` chars
 *     (default 40) — content has to lead, brand earns its place at the end.
 *   - Length within [minLen, maxLen] (defaults 100–200).
 *
 * Returns null when acceptable, or a short reason string when rejected.
 */
export function metaDescriptionAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  opts: { minLen?: number; maxLen?: number; brandLeadGuardChars?: number } = {},
): string | null {
  const minLen = opts.minLen ?? 100;
  const maxLen = opts.maxLen ?? 200;
  const brandLeadGuardChars = opts.brandLeadGuardChars ?? 40;
  if (!meta) return "desc-empty";
  if (meta.length < minLen) return `desc-too-short-${meta.length}`;
  if (meta.length > maxLen) return `desc-too-long-${meta.length}`;
  const lower = meta.toLowerCase();
  if (!lower.includes(cityName.toLowerCase())) return "desc-missing-city";
  const persona = brand.personaDisplayName;
  if (persona.length === 0) return null; // defensive — brand-name unknown
  const personaEsc = persona.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandRe = new RegExp(`\\b${personaEsc}\\b`, "gi");
  const matches = meta.match(brandRe) ?? [];
  if (matches.length < 1) return "desc-missing-brand";
  if (matches.length > 2) return `desc-brand-overused-${matches.length}`;
  // 80/20 lead guard: no brand mention in the opening characters.
  const lead = meta.slice(0, brandLeadGuardChars);
  if (brandRe.test(lead)) return "desc-brand-in-lead";
  return null;
}

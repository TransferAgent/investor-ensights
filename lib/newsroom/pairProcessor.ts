import { createHash } from "node:crypto";
import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import { auditPressRelease, type AuditorInput, type AuditorResult, type AuditVerdict, type AuditorIssue } from "./auditor";
import { normalizeHayloBody } from "./hayloBodyNormalizer";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";
import { resolveBrandContext, type BrandContext } from "./brandContext";
import { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } from "@/lib/tenant/context";

// MT-4.12: meta-field shape constants.
//   Title: SERP `<title>`. Soft target ≤60, hard cap 90.
//   Description: Soft warn >200 (logged, NOT blocked per Conductor decision),
//   hard cap 300.
const META_TITLE_TARGET_CHARS = 60;
const META_TITLE_HARD_MAX = 90;
const META_DESCRIPTION_SOFT_WARN_CHARS = 200;
const META_DESCRIPTION_TARGET_CHARS = 200;
const META_DESCRIPTION_HARD_MAX = 300;

export interface PairInput {
  hayloArticle: Pick<HayloArticle, "id" | "slug" | "title" | "topicSlug" | "bodyHtml">;
  city: Pick<CityLocation, "slug" | "cityName" | "stateCode" | "stateName">;
  localVibe?: string | null;
  vibeSourceUrl?: string | null;
  dryRun?: boolean;
}

export interface PairResult {
  citySlug: string;
  hayloArticleId: string;
  composed: ComposeResult;
  audit: AuditorResult;
  draftPayload: NewsroomDraftPayloadV1;
  suggestedSlug: string;
}

export function buildSuggestedSlug(citySlug: string, hayloSlug: string): string {
  // MT-4.5: persona slug = schema name = article slug prefix (locked decision in
  // replit.md). Use the current tenant context — Tableicity yields the original
  // "tableicity-..." prefix (backward compatible with all 80 published slugs);
  // any other tenant gets its own persona prefix. Falls back to DEFAULT_TENANT_SLUG
  // ("tableicity") outside a request, preserving prior CLI behaviour.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } = require("@/lib/tenant/context") as typeof import("@/lib/tenant/context");
  const personaSlug = getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG;
  const base = `${personaSlug}-${citySlug}-${hayloSlug}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 110);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|div)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) return text ? [text] : [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function hardTruncateToPeriod(sentence: string, maxChars: number): string {
  if (sentence.length <= maxChars) return sentence;
  const slice = sentence.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:—\-–]+$/, "") + ".";
}

function buildMetaDescriptionFromBody(bodyHtml: string, maxChars: number): string | null {
  const normalized = normalizeHayloBody(bodyHtml);
  const text = htmlToPlainText(normalized);
  if (!text) return null;

  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;

  let acc = "";
  for (const s of sentences) {
    const tentative = acc ? `${acc} ${s}` : s;
    if (tentative.length > maxChars) {
      if (!acc) {
        return hardTruncateToPeriod(s, maxChars);
      }
      return acc;
    }
    acc = tentative;
  }
  return acc || null;
}

/**
 * Trim to a maximum length without cutting a word in half. Adds a single
 * trailing period (so meta strings always end on a sentence boundary) when
 * truncation drops a word.
 */
function truncateAtWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  const stripped = cut.replace(/[\s,;:—\-–]+$/, "");
  return /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
}

/**
 * MT-4.12: deterministic Tier-2 SEO `<title>` (SERP). Format is the locked
 * "${brand} in ${city}, ${state}: ${suffix}" prefix the Conductor approved.
 * Suffix derives from the Haylo article's title (or a generic fallback).
 *
 * Used:
 *   - by `processPair` (dry-run path) where there is no LLM output
 *   - by `pairAgentOrchestrator` Tier-2 fallback when the LLM-emitted
 *     metaTitle fails the brand+city contains-check (see `metaContainsBrandAndCity`)
 *   - by the Tableicity 84-article backfill script
 */
export function buildMetaTitle(
  brand: BrandContext,
  cityName: string,
  stateCode: string,
  hayloTitle?: string | null,
): string {
  const persona = brand.personaDisplayName;
  const prefix = `${persona} in ${cityName}, ${stateCode}: `;
  const remaining = META_TITLE_HARD_MAX - prefix.length;
  const rawSuffix = (hayloTitle ?? "").trim();
  const suffix = rawSuffix
    ? truncateAtWordBoundary(rawSuffix, Math.max(10, remaining)).replace(/\.$/, "")
    : `${brand.brandFeatureCta}`.replace(/\.$/, "");
  const out = `${prefix}${suffix}`.slice(0, META_TITLE_HARD_MAX);
  if (out.length > META_TITLE_TARGET_CHARS) {
    console.warn(
      `[buildMetaTitle] soft-warn: meta_title is ${out.length} chars (>${META_TITLE_TARGET_CHARS} target) for ${persona}/${cityName}.`,
    );
  }
  return out;
}

/**
 * MT-4.12: deterministic Tier-2 SEO meta description. Always begins with the
 * "${brand} in ${city}, ${state}: " prefix so each city/persona pair gets a
 * unique opening (fixes the duplicate-content bug in the legacy Tier-3 string).
 *
 * Body of the description is derived from the Haylo essay's first sentences;
 * if no body is supplied, falls back to the Haylo title + brand tagline.
 */
export function buildMetaDescription(
  brand: BrandContext,
  cityName: string,
  stateCode: string,
  hayloTitle: string,
  hayloBodyHtml?: string,
): string {
  const prefix = `${brand.personaDisplayName} in ${cityName}, ${stateCode}: `;
  const remaining = META_DESCRIPTION_HARD_MAX - prefix.length;

  let suffix: string | null = null;
  if (hayloBodyHtml) {
    suffix = buildMetaDescriptionFromBody(hayloBodyHtml, remaining);
  }
  if (!suffix) {
    suffix = `${hayloTitle.trim()} — ${brand.brandTagline}.`;
  }

  const out = truncateAtWordBoundary(`${prefix}${suffix}`, META_DESCRIPTION_HARD_MAX);
  if (out.length > META_DESCRIPTION_SOFT_WARN_CHARS) {
    console.warn(
      `[buildMetaDescription] soft-warn: meta_description is ${out.length} chars (>${META_DESCRIPTION_SOFT_WARN_CHARS} target) for ${brand.personaDisplayName}/${cityName}.`,
    );
  }
  return out;
}

function mockAudit(input: { citySlug: string; hayloArticleId: string; localVibeWasInjected: boolean; warnings: string[] }): AuditorResult {
  const seed = createHash("sha1").update(`${input.citySlug}|${input.hayloArticleId}`).digest()[0];
  const bucket = seed % 10;

  const issues: AuditorIssue[] = [];
  if (!input.localVibeWasInjected) {
    issues.push({
      severity: "low",
      category: "vibe-flow",
      message: "Local vibe was not injected (no v3 grounded vibe available for this city yet).",
    });
  }
  for (const w of input.warnings.slice(0, 2)) {
    issues.push({ severity: "low", category: "template-artifact", message: w });
  }

  const flowScore = 85 + (bucket % 3);
  return {
    verdict: "pass",
    flowScore,
    issues,
    summary: "Dry run: composition looks coherent. (Mock — set OPENAI_API_KEY and uncheck Dry Run for a real audit.)",
    costUsd: 0,
    totalTokens: 0,
  };
}

export async function processPair(input: PairInput): Promise<PairResult> {
  const composeInput: ComposeInput = {
    hayloTitle: input.hayloArticle.title,
    hayloBodyHtml: input.hayloArticle.bodyHtml,
    cityName: input.city.cityName,
    stateCode: input.city.stateCode,
    stateName: input.city.stateName ?? null,
    localVibe: input.localVibe ?? null,
    vibeSourceUrl: input.vibeSourceUrl ?? null,
    topicSlug: input.hayloArticle.topicSlug ?? undefined,
  };
  const composed = composePressRelease(composeInput);

  let audit: AuditorResult;
  if (input.dryRun) {
    audit = mockAudit({
      citySlug: input.city.slug,
      hayloArticleId: input.hayloArticle.id,
      localVibeWasInjected: composed.vibeInjected,
      warnings: composed.warnings,
    });
  } else {
    const auditorInput: AuditorInput = {
      cityName: input.city.cityName,
      stateCode: input.city.stateCode,
      localVibe: input.localVibe ?? null,
      fullHtml: composed.fullHtml,
    };
    audit = await auditPressRelease(auditorInput);
  }

  const suggestedSlug = buildSuggestedSlug(input.city.slug, input.hayloArticle.slug);
  // MT-4.12: dry-run path has no LLM output, so meta is always Tier-2 (deterministic).
  const brand = await resolveBrandContext(
    getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG,
  );
  const metaTitle = buildMetaTitle(
    brand,
    input.city.cityName,
    input.city.stateCode,
    input.hayloArticle.title,
  );
  const metaDescription = buildMetaDescription(
    brand,
    input.city.cityName,
    input.city.stateCode,
    input.hayloArticle.title,
    input.hayloArticle.bodyHtml,
  );

  const draftPayload: NewsroomDraftPayloadV1 = {
    version: "v1",
    citySlug: input.city.slug,
    suggestedSlug,
    title: composed.title,
    metaTitle,
    metaDescription,
    metaSource: "fallback",
    headline: composed.title,
    dateline: composed.dateline,
    bodyHtml: composed.fullHtml,
    authorName: brand.authorName,
    publisherName: brand.publisherName,
    hayloArticleId: input.hayloArticle.id,
    auditVerdict: audit.verdict,
    auditFlowScore: audit.flowScore,
    auditSummary: audit.summary,
    auditIssues: audit.issues,
  };

  return {
    citySlug: input.city.slug,
    hayloArticleId: input.hayloArticle.id,
    composed,
    audit,
    draftPayload,
    suggestedSlug,
  };
}

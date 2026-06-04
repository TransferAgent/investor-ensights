import type { BrandContext } from "@/lib/newsroom/brandContext";
import { metaTitleAcceptable } from "@/lib/newsroom/brandContext";

/**
 * MT-City-Meta G2 — City meta contract (pure functions, no LLM, no DB).
 *
 * This module is the single source of truth for the SERP-fit rules the City
 * Meta generator (G3) must satisfy. It mirrors the article meta contract in
 * spirit but encodes the Conductor-locked City-specific rules:
 *
 *   DESCRIPTION (generated FIRST, RAG-grounded on the persona truth doc):
 *     - target 160 chars, HARD MAX 165, floor CITY_META_DESC_MIN.
 *     - MUST be a complete sentence — ends in terminal punctuation (. ! ?),
 *       never a mid-word truncation.
 *     - MUST contain the city name verbatim (case-insensitive).
 *     - Brand appears EXACTLY ONCE, and that mention MUST be in the closing
 *       sentence (the "80% product description + 20% brand solution at the
 *       end" rule — brand earns its place last, never leads).
 *     - Composition target is 80% product description / 20% brand solution;
 *       that ratio is a *generation instruction*, not a numerically-enforced
 *       gate (ratio can't be measured reliably) — the brand-once-in-closing
 *       rule is its enforceable proxy.
 *
 *   TITLE (generated SECOND):
 *     - target 55, HARD MAX 65 (Google truncates SERP titles ~60).
 *     - MUST contain the city name verbatim.
 *     - MUST NOT contain the brand/persona name (it earns its place in the
 *       H1, canonical URL, and description; the title budget is for the city).
 *
 * Every gate returns `null` on pass, or a short machine-readable reason string
 * on reject (mirrors `metaTitleAcceptable` / `metaDescriptionAcceptable`), so
 * the G3 two-shot retry can feed the reason back to the LLM verbatim.
 */

export const CITY_META_DESC_TARGET = 160;
export const CITY_META_DESC_HARD_MAX = 165;
export const CITY_META_DESC_MIN = 140;

export const CITY_META_TITLE_TARGET = 55;
export const CITY_META_TITLE_HARD_MAX = 65;

/** Documentation-only: the intended description composition split. */
export const CITY_META_DESC_PRODUCT_RATIO = 0.8;
export const CITY_META_DESC_BRAND_RATIO = 0.2;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split into sentences on terminal punctuation followed by whitespace. Good
 * enough for meta descriptions (1-2 sentences); not a general NLP tokenizer.
 */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The trailing sentence of a description (empty string if none). */
export function closingSentence(text: string): string {
  const parts = splitSentences(text);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/**
 * City Meta TITLE gate. Thin wrapper over the shared `metaTitleAcceptable`
 * (city verbatim + brand-free + length) pinned to the City hard max.
 */
export function cityMetaTitleAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
): string | null {
  return metaTitleAcceptable(meta, brand, cityName, CITY_META_TITLE_HARD_MAX);
}

/**
 * City Meta DESCRIPTION gate. Encodes the full Conductor-locked contract.
 * Returns null when acceptable, else a short reason string.
 */
export function cityMetaDescriptionAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  opts: { minLen?: number; maxLen?: number } = {},
): string | null {
  const minLen = opts.minLen ?? CITY_META_DESC_MIN;
  const maxLen = opts.maxLen ?? CITY_META_DESC_HARD_MAX;

  if (!meta) return "desc-empty";
  const text = meta.trim();
  const len = text.length;
  if (len < minLen) return `desc-too-short-${len}`;
  if (len > maxLen) return `desc-too-long-${len}`;

  // Complete sentence — must end on terminal punctuation, never mid-word.
  if (!/[.!?]["')\]]?$/.test(text)) return "desc-not-complete-sentence";

  // City verbatim.
  if (!text.toLowerCase().includes(cityName.toLowerCase())) {
    return "desc-missing-city";
  }

  // Brand: exactly once, in the closing sentence.
  const persona = brand.personaDisplayName ?? "";
  if (persona.length === 0) return null; // defensive — brand unknown, skip brand gate
  const brandRe = new RegExp(`\\b${escapeRegExp(persona)}\\b`, "gi");
  const total = (text.match(brandRe) ?? []).length;
  if (total === 0) return "desc-missing-brand";
  if (total > 1) return `desc-brand-repeated-${total}`;
  const last = closingSentence(text);
  if (!new RegExp(`\\b${escapeRegExp(persona)}\\b`, "i").test(last)) {
    return "desc-brand-not-in-closing";
  }

  return null;
}

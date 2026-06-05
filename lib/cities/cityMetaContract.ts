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
 *     - MUST NOT contain the state code (e.g. the "TX" in "Austin, TX") — the
 *       Conductor wants city-only titles to kill the "door-hanger" look. The
 *       guard is a case-sensitive word-boundary match on the uppercase code, so
 *       it catches "Austin, TX" without tripping on lowercase words that happen
 *       to spell a code (e.g. "or", "in").
 *
 * Every gate returns `null` on pass, or a short machine-readable reason string
 * on reject (mirrors `metaTitleAcceptable` / `metaDescriptionAcceptable`), so
 * the G3 two-shot retry can feed the reason back to the LLM verbatim.
 */

export const CITY_META_DESC_TARGET = 160;
export const CITY_META_DESC_HARD_MAX = 165;
/**
 * Floor. Set to 130 (not 140) so the generator can aim the model BELOW the 165
 * ceiling for margin without tripping a too-short reject. A 130–160 char SERP
 * snippet is still substantive (Google renders ~155-160). The Conductor spec
 * pins the *target* (160) and *hard max* (165); the floor is ours to tune.
 */
export const CITY_META_DESC_MIN = 130;
/**
 * Brand may not appear within the first N chars. This is the "content leads,
 * brand earns its place at the end" guard. It also closes the single-sentence
 * loophole in the closing-sentence rule below: when the whole description is
 * one sentence, "closing sentence" == the sentence, so a brand at the front
 * would otherwise pass — the lead guard rejects it.
 */
export const CITY_META_DESC_BRAND_LEAD_GUARD = 40;

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
 * City Meta TITLE gate. Wraps the shared `metaTitleAcceptable` (city verbatim +
 * brand-free + length, pinned to the City hard max) and adds the City-specific
 * "no state code" guard so titles read "Austin" not "Austin, TX" (door-hanger
 * elimination — Conductor decision). Pass `stateCode` to enable the guard;
 * omit it (or pass empty) and the title is gated exactly as before.
 */
export function cityMetaTitleAcceptable(
  meta: string | null | undefined,
  brand: BrandContext,
  cityName: string,
  stateCode?: string | null,
): string | null {
  const base = metaTitleAcceptable(meta, brand, cityName, CITY_META_TITLE_HARD_MAX);
  if (base) return base;

  const code = (stateCode ?? "").trim().toUpperCase();
  if (meta && code.length > 0) {
    // Match the UPPERCASE code as a word-boundary token. We normalize the code
    // to uppercase (above) and match case-sensitively, so it catches "Austin,
    // TX" / a standalone "TX" but does NOT reject lowercase words that happen to
    // spell a code ("portland or austin", "based in austin").
    const stateRe = new RegExp(`\\b${escapeRegExp(code)}\\b`);
    if (stateRe.test(meta)) return "title-contains-state";
  }
  return null;
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
  // Lead guard: no brand in the opening chars (also closes the single-sentence
  // loophole — see CITY_META_DESC_BRAND_LEAD_GUARD).
  const lead = text.slice(0, CITY_META_DESC_BRAND_LEAD_GUARD);
  if (new RegExp(`\\b${escapeRegExp(persona)}\\b`, "i").test(lead)) {
    return "desc-brand-in-lead";
  }
  // And the single mention must land in the closing sentence.
  const last = closingSentence(text);
  if (!new RegExp(`\\b${escapeRegExp(persona)}\\b`, "i").test(last)) {
    return "desc-brand-not-in-closing";
  }

  return null;
}

/**
 * Deterministic length repair for an OVER-LENGTH description.
 *
 * LLMs cannot count characters, so a too-long description that is otherwise
 * on-contract (city present, single brand mention in a short closing sentence)
 * is common. When the description has a droppable middle — i.e. 3+ sentences —
 * we can guarantee the ceiling by dropping whole content sentences while
 * preserving (a) the first content sentence (carries the city) and (b) the
 * brand closing sentence. The result is re-validated against the FULL contract
 * before being returned, so this can never produce an off-contract string.
 *
 * Returns the repaired description (passes `cityMetaDescriptionAcceptable`), or
 * null when it can't be safely fixed (e.g. only two sentences, both needed).
 * Caller then treats it as an llm-failed skip.
 */
export function repairCityMetaDescriptionLength(
  text: string,
  brand: BrandContext,
  cityName: string,
  opts: { minLen?: number; maxLen?: number } = {},
): string | null {
  const maxLen = opts.maxLen ?? CITY_META_DESC_HARD_MAX;
  if (text.length <= maxLen) {
    return cityMetaDescriptionAcceptable(text, brand, cityName, opts) === null ? text : null;
  }
  const persona = brand.personaDisplayName ?? "";
  if (persona.length === 0) return null;
  const sentences = splitSentences(text);
  if (sentences.length < 3) return null; // no droppable middle

  const brandRe = new RegExp(`\\b${escapeRegExp(persona)}\\b`, "i");
  let brandIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (brandRe.test(sentences[i])) brandIdx = i; // last match wins (closing)
  }
  if (brandIdx === -1) return null;
  const brandSentence = sentences[brandIdx];
  const content = sentences.filter((_, i) => i !== brandIdx);

  // Keep the longest leading run of content sentences (the first one carries
  // the city) that still fits with the brand closing sentence appended.
  for (let k = content.length - 1; k >= 1; k--) {
    const candidate = [...content.slice(0, k), brandSentence].join(" ");
    if (cityMetaDescriptionAcceptable(candidate, brand, cityName, opts) === null) {
      return candidate;
    }
  }
  return null;
}

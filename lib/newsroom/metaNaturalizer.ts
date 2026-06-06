import OpenAI from "openai";
import type { BrandContext } from "./brandContext";
import { metaTitleAcceptable, metaDescriptionAcceptable } from "./brandContext";

/**
 * MT-4.13.3 / MT-4.13.4 — Tier-2.5 LLM Meta Naturalizer.
 *
 * Background. The deterministic Tier-2 builder (`buildMetaTitle` /
 * `buildMetaDescription` in `pairProcessor.ts`) is the safety net: it
 * guarantees every article has SEO-unique meta by gluing
 * "${persona} in ${city}, ${state}: ${haylo title or first sentences}".
 * That's safe but glue-y. The Conductor wants the persona + city woven
 * INTO the SERP headline naturally, not bolted on with a colon prefix.
 *
 * This module is the single in-line LLM "polish" pass:
 *   - INPUT: brand context, city/state, haylo title + body, AND the
 *     formula-built fallback strings (so we always have a baseline).
 *   - OUTPUT: a naturalized {title, description} pair, OR — if the LLM
 *     fails any guard — the unchanged fallbacks. Never throws to the
 *     caller; degrades silently to the safety net.
 *
 * Guards (a naturalized output is only used if it passes ALL of these):
 *   1. Title ≤ META_TITLE_HARD_MAX (65)
 *   2. Description in [META_DESCRIPTION_MIN (250), META_DESCRIPTION_HARD_MAX (300)]
 *   3. Both title AND description contain the persona name AND city name
 *      (case-insensitive substring; mirrors `metaContainsBrandAndCity`)
 *   4. No leading "${persona} in ${city}, ${state}:" colon-prefix (would
 *      mean the LLM just echoed the formula)
 *   5. Strict JSON parse with title + description string fields
 *
 * Cost: gpt-4.1 (full) at ~$2.00 / $8.00 per M tokens (in/out). Each call
 * is well under 1000 tokens combined → ~$0.004/article; worst case (3
 * attempts) still ~$0.012/article. Trivial — the SERP snippet is the
 * customer's first impression, so we spend the strong model here.
 *
 * Audit. Caller is responsible for `logAuditEvent("meta.naturalized", ...)`
 * — this module just returns the receipt fields (model, tokens, costUsd,
 * source) so callers (live pipeline + backfill script) can log uniformly.
 */

const MODEL = "gpt-4.1";

// MT-4.13.4 contract.
const META_TITLE_HARD_MAX = 65;
const META_TITLE_TARGET = 55;
const META_DESCRIPTION_HARD_MAX = 300;
const META_DESCRIPTION_TARGET = 275;
const META_DESCRIPTION_MIN = 250;
const META_DESCRIPTION_BRAND_LEAD_GUARD = 40;

export type NaturalizedMetaSource = "naturalized" | "fallback";

export interface NaturalizeMetaInput {
  brand: BrandContext;
  cityName: string;
  stateCode: string;
  hayloTitle: string;
  /**
   * First ~4000 chars of plain-text Haylo body, for grounding the LLM.
   * Caller pre-strips HTML so we don't burn tokens on tags.
   */
  hayloBodyExcerpt: string;
  /**
   * Tier-2 deterministic strings. ALWAYS used as the silent fallback if
   * the LLM trips any guard. The naturalizer never returns null.
   */
  fallbackTitle: string;
  fallbackDescription: string;
}

export interface NaturalizeMetaResult {
  title: string;
  description: string;
  source: NaturalizedMetaSource;
  /** "naturalized": the LLM passed all guards. "fallback": fell through. */
  rejectionReason: string | null;
  model: string;
  tokensUsed: number;
  costUsd: number;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OpenAi_Key;
  if (!apiKey) throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or OpenAi_Key.");
  return new OpenAI({ apiKey });
}

function costFor(promptTokens: number, completionTokens: number): number {
  // gpt-4.1 (full) pricing: $2.00 / 1M input, $8.00 / 1M output.
  const cost = (promptTokens / 1_000_000) * 2.0 + (completionTokens / 1_000_000) * 8.0;
  return Number(cost.toFixed(6));
}

function buildSystemPrompt(): string {
  return `You are an SEO meta-tag stylist for a local-market press release publisher.

You write a DESCRIPTION (the SERP snippet) and a TITLE (the SERP <title>) that read like a useful local article — not a door-hanger ad. Work IN THIS ORDER: write the DESCRIPTION first, because it carries the substance; THEN write a TITLE whose hook is drawn from that same description. The title must never introduce a topic the description didn't raise.

STEP 1 — DESCRIPTION first (any violation rejects your output):
- This is the snippet a founder reads in Google. Shape it "80% content, 20% brand": about 80% is the real pain point, problem, or local detail taken from the article excerpt below; about 20% is the brand as the source/solution.
- LEAD with the pain point or the story. The brand earns ONE mention near the END as the source/CTA — never as the opener.
- Length: target ${META_DESCRIPTION_TARGET} characters, between ${META_DESCRIPTION_MIN} and ${META_DESCRIPTION_HARD_MAX}. Count carefully and fill the band.
- MUST contain the EXACT city name (case-insensitive).
- MUST contain the EXACT brand persona name AT LEAST ONCE and AT MOST TWICE. One mention is preferred.
- The brand name MUST NOT appear inside the first ${META_DESCRIPTION_BRAND_LEAD_GUARD} characters.
- One or two complete sentences. No emojis, no hashtags, no markdown.

STEP 2 — TITLE, derived from the description you just wrote (any violation rejects your output):
- It must echo the SAME pain point / angle as the description — a tight hook, not a new subject.
- Length: target ${META_TITLE_TARGET} characters, hard maximum ${META_TITLE_HARD_MAX}. Aim short — Google truncates around 60.
- MUST contain the EXACT city name (case-insensitive).
- MUST NOT contain the brand persona name (the H1, canonical URL, and description already carry it — putting it here burns SERP characters).
- MUST NOT contain the state name or the two-letter state code. Write the CITY ONLY (e.g. "Albany", never "Albany, NY"). A "City, ST" stamp reads like a door-hanger and is rejected.
- Single line. No emojis. No hashtags. No quotation marks wrapping the whole title. No trailing punctuation except an optional period.

Universal rules:
- American English. Address founders / operators plainly.
- Do not invent statistics or facts. Stay within the topic of the article excerpt you are given.
- Do not echo the deterministic-fallback strings you are shown — they are provided ONLY so you can beat them.

Return STRICT JSON ONLY (no prose, no code fences) in this exact shape:
{ "description": "...", "title": "..." }`;
}

function buildUserPrompt(input: NaturalizeMetaInput): string {
  const { brand, cityName, stateCode, hayloTitle, hayloBodyExcerpt, fallbackTitle, fallbackDescription } = input;
  return `Brand persona name (FORBIDDEN in title; required 1-2x in description, NOT in first ${META_DESCRIPTION_BRAND_LEAD_GUARD} chars): ${brand.personaDisplayName}
City (REQUIRED verbatim in BOTH outputs): ${cityName}
State code: ${stateCode}
Brand vertical: ${brand.brandVertical}
Brand tagline (for tone, do not copy verbatim): ${brand.brandTagline}

Haylo article title (the topic — keep meta on-topic):
${hayloTitle}

Haylo article excerpt (first ~4000 chars, for grounding the angle — do not quote verbatim):
${hayloBodyExcerpt}

For reference, the deterministic-fallback strings (do NOT copy — beat them):
fallback title: ${fallbackTitle}
fallback description: ${fallbackDescription}

Produce the JSON now.`;
}

interface ParsedLLM {
  title: string;
  description: string;
}

function parseStrictJson(raw: string): ParsedLLM | null {
  if (!raw) return null;
  // Tolerate ```json fences if the model adds them despite the prompt.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (
      obj &&
      typeof obj === "object" &&
      typeof obj.title === "string" &&
      typeof obj.description === "string"
    ) {
      return { title: obj.title.trim(), description: obj.description.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

function validateOrNull(
  parsed: ParsedLLM,
  input: NaturalizeMetaInput,
): { ok: true } | { ok: false; reason: string } {
  const { brand, cityName } = input;
  const titleReason = metaTitleAcceptable(parsed.title, brand, cityName, META_TITLE_HARD_MAX, input.stateCode);
  if (titleReason) return { ok: false, reason: titleReason };
  const descReason = metaDescriptionAcceptable(parsed.description, brand, cityName, {
    minLen: META_DESCRIPTION_MIN,
    maxLen: META_DESCRIPTION_HARD_MAX,
    brandLeadGuardChars: META_DESCRIPTION_BRAND_LEAD_GUARD,
  });
  if (descReason) return { ok: false, reason: descReason };
  return { ok: true };
}

/** Public entry point. NEVER throws — degrades silently to the fallback. */
export async function naturalizeMeta(input: NaturalizeMetaInput): Promise<NaturalizeMetaResult> {
  const baseline: Omit<NaturalizeMetaResult, "rejectionReason" | "source"> = {
    title: input.fallbackTitle,
    description: input.fallbackDescription,
    model: MODEL,
    tokensUsed: 0,
    costUsd: 0,
  };

  let client: OpenAI;
  try {
    client = getClient();
  } catch (err) {
    return { ...baseline, source: "fallback", rejectionReason: `no-api-key:${(err as Error).message}` };
  }

  // MT-4.14.1: three-shot — initial attempt, then up to two retries that each
  // quote the previous attempt + its rejection reason. The strong model
  // (gpt-4.1) on three swings makes the LLM the trustworthy first impression
  // on every article; the formula remains only as the never-throw safety net.
  const TEMPS = [0.6, 0.3, 0.2];
  const MAX_ATTEMPTS = 3;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastRejection: string | null = null;
  let lastAttempt: ParsedLLM | null = null;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: TEMPS[attempt] ?? 0.2,
        response_format: { type: "json_object" },
        messages,
      });
      raw = completion.choices?.[0]?.message?.content ?? "";
      totalPromptTokens += completion.usage?.prompt_tokens ?? 0;
      totalCompletionTokens += completion.usage?.completion_tokens ?? 0;
    } catch (err) {
      const tokensUsed = totalPromptTokens + totalCompletionTokens;
      const costUsd = costFor(totalPromptTokens, totalCompletionTokens);
      return { ...baseline, tokensUsed, costUsd, source: "fallback", rejectionReason: `openai-error:${(err as Error).message}` };
    }

    const parsed = parseStrictJson(raw);
    if (!parsed) {
      lastRejection = "json-parse-failed";
      if (attempt < MAX_ATTEMPTS - 1) {
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `That was not valid JSON. Return STRICT JSON only — no prose, no code fences — in the shape { "description": "...", "title": "..." }.`,
        });
      }
      continue;
    }
    lastAttempt = parsed;
    const v = validateOrNull(parsed, input);
    if (v.ok) {
      const tokensUsed = totalPromptTokens + totalCompletionTokens;
      const costUsd = costFor(totalPromptTokens, totalCompletionTokens);
      return {
        title: parsed.title,
        description: parsed.description,
        source: "naturalized",
        rejectionReason: null,
        model: MODEL,
        tokensUsed,
        costUsd,
      };
    }
    lastRejection = v.reason;
    if (attempt < MAX_ATTEMPTS - 1) {
      messages.push({ role: "assistant", content: JSON.stringify(parsed) });
      messages.push({
        role: "user",
        content: `Your previous attempt was rejected for: ${v.reason}. Try again, harder. DESCRIPTION first: it MUST contain both "${input.cityName}" and "${input.brand.personaDisplayName}", brand mentioned 1-2 times and NOT in the first ${META_DESCRIPTION_BRAND_LEAD_GUARD} characters, length between ${META_DESCRIPTION_MIN} and ${META_DESCRIPTION_HARD_MAX}, shaped ~80% pain point and ~20% brand. THEN derive the TITLE from that description: it MUST contain "${input.cityName}", MUST NOT contain "${input.brand.personaDisplayName}", MUST NOT contain the state code "${input.stateCode}" (city only, no "City, ST" stamp), length ≤ ${META_TITLE_HARD_MAX}.`,
      });
    }
  }

  // All three attempts failed validation — fall back to the formula. The last
  // attempt's strings are intentionally discarded; the formula is safer.
  void lastAttempt;
  const tokensUsed = totalPromptTokens + totalCompletionTokens;
  const costUsd = costFor(totalPromptTokens, totalCompletionTokens);
  return { ...baseline, tokensUsed, costUsd, source: "fallback", rejectionReason: lastRejection ?? "unknown" };
}

/** Plain-text excerpt helper for callers that only have body HTML. */
export function hayloBodyExcerptFromHtml(bodyHtml: string | null | undefined, maxChars = 1000): string {
  if (!bodyHtml) return "";
  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? slice.slice(0, lastSpace) : slice;
}

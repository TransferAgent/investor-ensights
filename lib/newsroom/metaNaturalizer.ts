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
 *   1. Title ≤ META_TITLE_HARD_MAX (90)
 *   2. Description in [META_DESCRIPTION_MIN (40), META_DESCRIPTION_HARD_MAX (300)]
 *   3. Both title AND description contain the persona name AND city name
 *      (case-insensitive substring; mirrors `metaContainsBrandAndCity`)
 *   4. No leading "${persona} in ${city}, ${state}:" colon-prefix (would
 *      mean the LLM just echoed the formula)
 *   5. Strict JSON parse with title + description string fields
 *
 * Cost: gpt-4.1-mini at ~$0.15 / $0.60 per M tokens (in/out). Each call
 * is well under 500 tokens combined → ~$0.0003/article. The 75 published
 * Tableicity articles re-naturalized via the backfill cost ~$0.025 total.
 *
 * Audit. Caller is responsible for `logAuditEvent("meta.naturalized", ...)`
 * — this module just returns the receipt fields (model, tokens, costUsd,
 * source) so callers (live pipeline + backfill script) can log uniformly.
 */

const MODEL = "gpt-4.1-mini";

// MT-4.13.4 contract.
const META_TITLE_HARD_MAX = 65;
const META_TITLE_TARGET = 55;
const META_DESCRIPTION_HARD_MAX = 200;
const META_DESCRIPTION_TARGET = 150;
const META_DESCRIPTION_MIN = 100;
const META_DESCRIPTION_BRAND_LEAD_GUARD = 40;

export type NaturalizedMetaSource = "naturalized" | "fallback";

export interface NaturalizeMetaInput {
  brand: BrandContext;
  cityName: string;
  stateCode: string;
  hayloTitle: string;
  /**
   * First ~1000 chars of plain-text Haylo body, for grounding the LLM.
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
  // gpt-4.1-mini pricing: $0.15 / 1M input, $0.60 / 1M output (matches auditor's gpt-4o-mini).
  const cost = (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
  return Number(cost.toFixed(6));
}

function buildSystemPrompt(): string {
  return `You are an SEO meta-tag stylist for a local-market press release publisher.

You write a TITLE (for the SERP <title>) and a DESCRIPTION (for the SERP snippet) that read like a useful local article — not like a door-hanger ad.

TITLE rules (any violation rejects your output):
- Length: target ${META_TITLE_TARGET} characters, hard maximum ${META_TITLE_HARD_MAX} characters. Aim short. Google truncates around 60.
- MUST contain the EXACT city name (case-insensitive).
- MUST NOT contain the brand persona name. Repeat: the brand name is forbidden in the title. (The brand is already carried by the H1, canonical URL, and description — putting it in the title burns SERP characters.)
- Single line. No emojis. No hashtags. No trailing punctuation except an optional period. No quotation marks wrapping the whole title.
- Lead with the topic or the city — make it useful to a founder skimming the SERP.

DESCRIPTION rules (any violation rejects your output):
- Length: target ${META_DESCRIPTION_TARGET} characters, between ${META_DESCRIPTION_MIN} and ${META_DESCRIPTION_HARD_MAX}.
- "80% content, 20% brand" — the description is content-first prose. Lead with the story, the problem, or the local detail. The brand earns one mention near the END as the source/CTA.
- MUST contain the EXACT city name (case-insensitive).
- MUST contain the EXACT brand persona name AT LEAST ONCE and AT MOST TWICE. One mention is preferred.
- The brand name MUST NOT appear inside the first ${META_DESCRIPTION_BRAND_LEAD_GUARD} characters. If you start a sentence with the brand it will be rejected.
- One or two complete sentences. No emojis, no hashtags, no markdown.

Universal rules:
- American English. Address founders / operators plainly.
- Do not invent statistics or facts. Stay within the topic of the haylo article you are given.
- Do not echo the deterministic-fallback strings you are shown — they are provided ONLY so you can do better.

Return STRICT JSON ONLY (no prose, no code fences) in this exact shape:
{ "title": "...", "description": "..." }`;
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

Haylo article excerpt (first ~1000 chars, for grounding the angle — do not quote verbatim):
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
  const titleReason = metaTitleAcceptable(parsed.title, brand, cityName, META_TITLE_HARD_MAX);
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

  // MT-4.13.4: try once, then retry once with a feedback message that quotes
  // the previous attempt + its rejection reason. Two-shot keeps cost under
  // ~$0.0006/article worst-case while substantially raising the pass rate.
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastRejection: string | null = null;
  let lastAttempt: ParsedLLM | null = null;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: attempt === 0 ? 0.6 : 0.3,
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
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `That was not valid JSON. Return STRICT JSON only — no prose, no code fences — in the shape { "title": "...", "description": "..." }.`,
      });
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
    if (attempt === 0) {
      messages.push({ role: "assistant", content: JSON.stringify(parsed) });
      messages.push({
        role: "user",
        content: `Your previous attempt was rejected for: ${v.reason}. Try again. Remember: title MUST contain "${input.cityName}" and MUST NOT contain "${input.brand.personaDisplayName}", title length ≤ ${META_TITLE_HARD_MAX}. Description MUST contain both "${input.cityName}" and "${input.brand.personaDisplayName}", brand mentioned 1-2 times and NOT in the first ${META_DESCRIPTION_BRAND_LEAD_GUARD} characters, length between ${META_DESCRIPTION_MIN} and ${META_DESCRIPTION_HARD_MAX}.`,
      });
    }
  }

  // Both attempts failed validation — fall back to the formula. Last
  // attempt's strings are intentionally discarded; formula is safer.
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

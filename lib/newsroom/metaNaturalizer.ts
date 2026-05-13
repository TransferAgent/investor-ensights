import OpenAI from "openai";
import type { BrandContext } from "./brandContext";
import { metaContainsBrandAndCity } from "./brandContext";

/**
 * MT-4.13.3 — Tier-2.5 LLM Meta Naturalizer.
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

const META_TITLE_HARD_MAX = 90;
const META_DESCRIPTION_HARD_MAX = 300;
const META_DESCRIPTION_MIN = 40;

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

Your job: rewrite a meta TITLE (for the SERP <title>) and meta DESCRIPTION (for the SERP snippet) so the brand persona name and the city sit NATURALLY inside the sentence — never as a "Brand in City, ST:" colon-prefix.

Hard rules (any violation will cause your output to be rejected):
- Title: maximum 90 characters, single line, no trailing punctuation other than a period.
- Description: between 40 and 300 characters, one or two complete sentences.
- BOTH the title AND the description must contain the EXACT persona name (case-insensitive) AND the EXACT city name (case-insensitive).
- Do NOT begin with the pattern "<persona> in <city>, <state>:" — that is the bolted-on style we are replacing.
- No emojis. No hashtags. No quotation marks around the entire output. No markdown.
- Do not invent statistics or facts. Stay within the topic of the haylo article you are given.
- Address the reader (founders / operators) plainly. American English.

Return STRICT JSON ONLY (no prose, no code fences) in this exact shape:
{ "title": "...", "description": "..." }`;
}

function buildUserPrompt(input: NaturalizeMetaInput): string {
  const { brand, cityName, stateCode, hayloTitle, hayloBodyExcerpt, fallbackTitle, fallbackDescription } = input;
  return `Persona name (must appear verbatim in both outputs): ${brand.personaDisplayName}
City (must appear verbatim in both outputs): ${cityName}
State code: ${stateCode}
Brand vertical: ${brand.brandVertical}
Brand tagline (for tone, do not copy verbatim): ${brand.brandTagline}

Haylo article title (this is the topic — keep the meta on-topic):
${hayloTitle}

Haylo article excerpt (first ~1000 chars, for grounding the angle — do not quote):
${hayloBodyExcerpt}

For reference, the deterministic fallback strings we are trying to improve on (do NOT copy these — they are the bolted-on style):
fallback title: ${fallbackTitle}
fallback description: ${fallbackDescription}

Now produce the JSON.`;
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

function startsWithFormulaPrefix(s: string, brand: BrandContext, cityName: string, stateCode: string): boolean {
  // Reject "${persona} in ${city}, ${ST}:" as a leading pattern — that's the
  // exact bolted-on style we are trying to escape from. Case-insensitive.
  const re = new RegExp(
    `^\\s*${brand.personaDisplayName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s+in\\s+${cityName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")},\\s*${stateCode.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*:`,
    "i",
  );
  return re.test(s);
}

function validateOrNull(
  parsed: ParsedLLM,
  input: NaturalizeMetaInput,
): { ok: true } | { ok: false; reason: string } {
  const { brand, cityName, stateCode } = input;
  const t = parsed.title;
  const d = parsed.description;
  if (t.length === 0 || t.length > META_TITLE_HARD_MAX) {
    return { ok: false, reason: `title-length-${t.length}` };
  }
  if (d.length < META_DESCRIPTION_MIN || d.length > META_DESCRIPTION_HARD_MAX) {
    return { ok: false, reason: `description-length-${d.length}` };
  }
  if (!metaContainsBrandAndCity(t, brand, cityName)) {
    return { ok: false, reason: "title-missing-brand-or-city" };
  }
  if (!metaContainsBrandAndCity(d, brand, cityName)) {
    return { ok: false, reason: "description-missing-brand-or-city" };
  }
  if (startsWithFormulaPrefix(t, brand, cityName, stateCode)) {
    return { ok: false, reason: "title-echoes-formula-prefix" };
  }
  if (startsWithFormulaPrefix(d, brand, cityName, stateCode)) {
    return { ok: false, reason: "description-echoes-formula-prefix" };
  }
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

  let raw: string;
  let promptTokens = 0;
  let completionTokens = 0;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });
    raw = completion.choices?.[0]?.message?.content ?? "";
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
  } catch (err) {
    return { ...baseline, source: "fallback", rejectionReason: `openai-error:${(err as Error).message}` };
  }

  const tokensUsed = promptTokens + completionTokens;
  const costUsd = costFor(promptTokens, completionTokens);

  const parsed = parseStrictJson(raw);
  if (!parsed) {
    return { ...baseline, tokensUsed, costUsd, source: "fallback", rejectionReason: "json-parse-failed" };
  }
  const v = validateOrNull(parsed, input);
  if (!v.ok) {
    return { ...baseline, tokensUsed, costUsd, source: "fallback", rejectionReason: v.reason };
  }

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

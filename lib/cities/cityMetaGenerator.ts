import OpenAI from "openai";
import type { BrandContext } from "@/lib/newsroom/brandContext";
import { hayloBodyExcerptFromHtml } from "@/lib/newsroom/metaNaturalizer";
import {
  CITY_META_DESC_BRAND_LEAD_GUARD,
  CITY_META_DESC_HARD_MAX,
  CITY_META_DESC_MIN,
  CITY_META_DESC_TARGET,
  CITY_META_TITLE_HARD_MAX,
  CITY_META_TITLE_TARGET,
  cityMetaDescriptionAcceptable,
  cityMetaTitleAcceptable,
  repairCityMetaDescriptionLength,
} from "@/lib/cities/cityMetaContract";

/**
 * MT-City-Meta G3 — RAG-grounded City Meta generator (COMPUTE ONLY).
 *
 * Generates a per-city SEO meta DESCRIPTION first (RAG-grounded on the
 * persona's Haylo "truth document"), then a brand-free TITLE second — the
 * order the Conductor specified. Each step is a two-shot LLM call validated
 * against the G2 contract (`cityMetaContract.ts`); on a first-shot reject the
 * rejection reason is fed back to the model for one stricter retry.
 *
 * Hard guarantees:
 *   - NEVER throws. Every failure path resolves to a typed status.
 *   - WRITES NOTHING. This module only computes + validates; persistence and
 *     audit are G4's job. (Render-time generation is explicitly forbidden.)
 *   - No truth doc → status `no-truth-doc`, caller writes nothing and the
 *     public page keeps its pre-LLM render fallback.
 *   - Truth doc present but both shots fail a gate → status `llm-failed`,
 *     caller writes nothing (explicit failure beats a silent bad value; the
 *     140–165 / brand-in-closing band is too tight for a reliable formula).
 *
 * Cost: gpt-4.1-mini, two short calls (desc + title), each up to two shots →
 * worst case ~4 calls < ~$0.0015/city. Typical ~$0.0006/city.
 */

// Per-step models. The DESCRIPTION must hit a tight 130–165 char band with two
// natural sentences and brand-once-in-closing — gpt-4.1-mini can't follow that
// length constraint reliably (~50% reject from overshoot), so the description
// uses full gpt-4.1 (far better instruction-following). The TITLE is easy
// (≤65, city verbatim, no brand) and stays on mini. This runs once at
// write-time, so the few extra cents per full rollout are immaterial.
const DESC_MODEL = "gpt-4.1";
const TITLE_MODEL = "gpt-4.1-mini";
/** Back-compat alias reported on results (the description model drives quality). */
const MODEL = DESC_MODEL;
const TRUTH_DOC_EXCERPT_CHARS = 4000;

/** USD per 1M tokens, [input, output]. */
const PRICING: Record<string, [number, number]> = {
  "gpt-4.1": [2.0, 8.0],
  "gpt-4.1-mini": [0.15, 0.6],
};

export type CityMetaStatus =
  | "generated"
  | "no-truth-doc"
  | "llm-failed"
  | "no-api-key";

export interface GenerateCityMetaInput {
  brand: BrandContext;
  cityName: string;
  stateCode: string;
  /** Haylo truth-doc title (topic anchor). */
  truthDocTitle: string;
  /**
   * Plain-text truth-doc body. Pass raw body HTML and it will be stripped +
   * capped, or a pre-stripped string. Empty/undefined ⇒ treated as no doc.
   */
  truthDocBody?: string | null;
}

export interface CityMetaResult {
  status: CityMetaStatus;
  title: string | null;
  description: string | null;
  /** "llm" only when status === "generated". Never "fallback" here. */
  metaSource: "llm" | null;
  /** Short machine-readable reason when not "generated". */
  rejectionReason: string | null;
  model: string;
  tokensUsed: number;
  costUsd: number;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OpenAi_Key;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or OpenAi_Key.");
  }
  return new OpenAI({ apiKey });
}

function costFor(model: string, promptTokens: number, completionTokens: number): number {
  const [inPrice, outPrice] = PRICING[model] ?? PRICING["gpt-4.1-mini"];
  const cost = (promptTokens / 1_000_000) * inPrice + (completionTokens / 1_000_000) * outPrice;
  return Number(cost.toFixed(6));
}

function parseField(raw: string, field: "title" | "description"): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && typeof obj[field] === "string") {
      return (obj[field] as string).trim();
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DESCRIPTION (generated FIRST, RAG-grounded)
// ---------------------------------------------------------------------------

function descSystemPrompt(): string {
  return `You write the SEO meta DESCRIPTION (the grey snippet under a Google result) for a local city page on a local-market intelligence publisher.

The description is "80% content, 20% brand": about 80% describes the topic/product plainly and usefully, and the final ~20% positions the brand as the solution. Think helpful local explainer, NOT an ad.

RULES (any violation rejects your output):
- Length: AIM for about ${CITY_META_DESC_HARD_MAX - 20} characters and it MUST stay between ${CITY_META_DESC_MIN} and ${CITY_META_DESC_HARD_MAX}. Aiming well under the ${CITY_META_DESC_HARD_MAX} ceiling protects you from overshooting — never exceed it. Prefer TWO short sentences over one long one. Count carefully.
- MUST be one or two COMPLETE sentences ending in terminal punctuation (. ! ?). Never cut off mid-thought.
- MUST contain the EXACT city name (case-insensitive), verbatim.
- The brand name MUST appear EXACTLY ONCE, and that single mention MUST be in the FINAL sentence (it is the closing "solution" beat).
- The brand name MUST NOT appear within the first ${CITY_META_DESC_BRAND_LEAD_GUARD} characters. Content leads; the brand earns its place at the end.
- Ground the topic in the provided truth document. Do not invent statistics or facts. American English. No emojis, hashtags, markdown, or quotation marks wrapping the whole thing.

Return STRICT JSON ONLY (no prose, no code fences): { "description": "..." }`;
}

function descUserPrompt(input: GenerateCityMetaInput, excerpt: string): string {
  return `Brand name (required EXACTLY ONCE, in the final sentence, NOT in first ${CITY_META_DESC_BRAND_LEAD_GUARD} chars): ${input.brand.personaDisplayName}
City (required verbatim): ${input.cityName}
State code: ${input.stateCode}
Brand vertical (tone only): ${input.brand.brandVertical}

Truth document title (the topic to describe):
${input.truthDocTitle}

Truth document body (ground the 80% content here — paraphrase, do not quote verbatim):
${excerpt}

Write the description JSON now.`;
}

// ---------------------------------------------------------------------------
// TITLE (generated SECOND, brand-free, aligned to the description)
// ---------------------------------------------------------------------------

function titleSystemPrompt(): string {
  return `You write the SEO meta TITLE (the blue clickable headline) for a local city page.

RULES (any violation rejects your output):
- Length: target ${CITY_META_TITLE_TARGET} characters, hard maximum ${CITY_META_TITLE_HARD_MAX}. Google truncates around 60 — keep it tight.
- MUST contain the EXACT city name (case-insensitive), verbatim.
- MUST NOT contain the brand name. The brand belongs to the H1, URL, and description — spending title characters on it is wasteful.
- Single line, on-topic with the description you are given. No emojis, hashtags, or wrapping quotation marks. Optional single trailing period only.

Return STRICT JSON ONLY (no prose, no code fences): { "title": "..." }`;
}

function titleUserPrompt(input: GenerateCityMetaInput, description: string): string {
  return `Brand name (FORBIDDEN in the title): ${input.brand.personaDisplayName}
City (required verbatim): ${input.cityName}
State code: ${input.stateCode}

The approved description for this same page (match its topic, do not repeat it):
${description}

Write the title JSON now.`;
}

// ---------------------------------------------------------------------------
// Surgical, rejection-aware retry hints
// ---------------------------------------------------------------------------

function descRetryHint(candidate: string, reason: string, input: GenerateCityMetaInput): string {
  const brand = input.brand.personaDisplayName;
  const city = input.cityName;
  const aim = CITY_META_DESC_HARD_MAX - 20;
  if (reason.startsWith("desc-too-long")) {
    const cut = candidate.length - CITY_META_DESC_HARD_MAX + 12; // overshoot + margin
    return `It is too long. Return the SAME description shortened by at least ${cut} characters to land near ${aim}. Trim wording from the earlier content sentence(s); keep the FINAL sentence (the one with "${brand}") intact. Stay a complete sentence.`;
  }
  if (reason.startsWith("desc-too-short")) {
    const add = CITY_META_DESC_MIN - candidate.length + 12;
    return `It is too short. Add about ${add} characters of useful local detail to the content portion. Keep "${brand}" EXACTLY ONCE in the final sentence and "${city}" verbatim.`;
  }
  if (reason === "desc-brand-in-lead") {
    return `Move "${brand}" out of the opening — it must not appear in the first ${CITY_META_DESC_BRAND_LEAD_GUARD} characters. Lead with the topic; put the single "${brand}" mention in the final sentence.`;
  }
  if (reason === "desc-brand-not-in-closing") {
    return `Put the single "${brand}" mention in the FINAL sentence as the closing solution beat.`;
  }
  if (reason.startsWith("desc-brand-repeated")) {
    return `Mention "${brand}" only ONCE, in the final sentence. Remove the other mention(s).`;
  }
  if (reason === "desc-missing-brand") {
    return `Add "${brand}" exactly once, in the final sentence.`;
  }
  if (reason === "desc-missing-city") {
    return `Include "${city}" verbatim in the description.`;
  }
  if (reason === "desc-not-complete-sentence") {
    return `End with terminal punctuation (a period). Do not cut off mid-thought.`;
  }
  return `Fix it: ${CITY_META_DESC_MIN}-${CITY_META_DESC_HARD_MAX} chars (aim ~${aim}), complete sentence, "${city}" verbatim, "${brand}" once in the final sentence and not in the first ${CITY_META_DESC_BRAND_LEAD_GUARD} chars.`;
}

function titleRetryHint(candidate: string, reason: string, input: GenerateCityMetaInput): string {
  const brand = input.brand.personaDisplayName;
  const city = input.cityName;
  if (reason.startsWith("title-too-long")) {
    const cut = candidate.length - CITY_META_TITLE_HARD_MAX + 5;
    return `Too long — shorten by at least ${cut} characters to land near ${CITY_META_TITLE_TARGET}. Keep "${city}" verbatim.`;
  }
  if (reason === "title-contains-brand") {
    return `Remove "${brand}" entirely — the brand is forbidden in the title. Keep "${city}".`;
  }
  if (reason === "title-missing-city") {
    return `Include "${city}" verbatim.`;
  }
  return `Fix it: ≤ ${CITY_META_TITLE_HARD_MAX} chars, "${city}" verbatim, no "${brand}".`;
}

// ---------------------------------------------------------------------------
// Two-shot runner shared by both steps
// ---------------------------------------------------------------------------

interface TwoShotOutcome {
  value: string | null;
  rejectionReason: string | null;
  /** Last parsed candidate, even when it failed validation (for deterministic repair). */
  lastCandidate: string | null;
  promptTokens: number;
  completionTokens: number;
}

async function runTwoShot(
  client: OpenAI,
  model: string,
  field: "title" | "description",
  systemPrompt: string,
  userPrompt: string,
  validate: (candidate: string) => string | null,
  /** Surgical, rejection-aware feedback for the next shot. */
  retryHint: (candidate: string, reason: string) => string,
  maxAttempts = 2,
): Promise<TwoShotOutcome> {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  let promptTokens = 0;
  let completionTokens = 0;
  let lastRejection: string | null = null;
  let lastCandidate: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      const completion = await client.chat.completions.create({
        model,
        // First shot creative; every retry drops to low temperature for control.
        temperature: attempt === 0 ? 0.6 : 0.3,
        response_format: { type: "json_object" },
        messages,
      });
      raw = completion.choices?.[0]?.message?.content ?? "";
      promptTokens += completion.usage?.prompt_tokens ?? 0;
      completionTokens += completion.usage?.completion_tokens ?? 0;
    } catch (err) {
      return {
        value: null,
        rejectionReason: `openai-error:${(err as Error).message}`,
        lastCandidate,
        promptTokens,
        completionTokens,
      };
    }

    const candidate = parseField(raw, field);
    if (!candidate) {
      lastRejection = "json-parse-failed";
      if (attempt < maxAttempts - 1) {
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `That was not valid JSON. Return STRICT JSON only in the shape { "${field}": "..." }.`,
        });
      }
      continue;
    }

    lastCandidate = candidate;
    const reason = validate(candidate);
    if (!reason) {
      return { value: candidate, rejectionReason: null, lastCandidate, promptTokens, completionTokens };
    }
    lastRejection = reason;
    if (attempt < maxAttempts - 1) {
      messages.push({ role: "assistant", content: JSON.stringify({ [field]: candidate }) });
      messages.push({
        role: "user",
        content: `Your previous ${field} (${candidate.length} chars) was rejected for: ${reason}. ${retryHint(candidate, reason)}`,
      });
    }
  }

  return { value: null, rejectionReason: lastRejection ?? "unknown", lastCandidate, promptTokens, completionTokens };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Compute-only. NEVER throws. Writes nothing. */
export async function generateCityMeta(input: GenerateCityMetaInput): Promise<CityMetaResult> {
  const base: Omit<CityMetaResult, "status" | "title" | "description" | "metaSource" | "rejectionReason"> = {
    model: MODEL,
    tokensUsed: 0,
    costUsd: 0,
  };

  const excerpt = hayloBodyExcerptFromHtml(input.truthDocBody, TRUTH_DOC_EXCERPT_CHARS);
  if (!input.truthDocTitle?.trim() || !excerpt) {
    return {
      ...base,
      status: "no-truth-doc",
      title: null,
      description: null,
      metaSource: null,
      rejectionReason: "no-truth-doc",
    };
  }

  let client: OpenAI;
  try {
    client = getClient();
  } catch (err) {
    return {
      ...base,
      status: "no-api-key",
      title: null,
      description: null,
      metaSource: null,
      rejectionReason: (err as Error).message,
    };
  }

  let tokensUsed = 0;
  let costUsd = 0;

  // Step 1 — DESCRIPTION first (gpt-4.1: tight 130–165 band is the hard part).
  const desc = await runTwoShot(
    client,
    DESC_MODEL,
    "description",
    descSystemPrompt(),
    descUserPrompt(input, excerpt),
    (c) => cityMetaDescriptionAcceptable(c, input.brand, input.cityName),
    (candidate, reason) => descRetryHint(candidate, reason, input),
    3,
  );
  tokensUsed += desc.promptTokens + desc.completionTokens;
  costUsd += costFor(DESC_MODEL, desc.promptTokens, desc.completionTokens);

  // The model cannot count characters, so a too-long-but-otherwise-on-contract
  // description is the dominant failure. Try a deterministic sentence-drop
  // repair (re-validated against the FULL contract) before giving up.
  let descValue = desc.value;
  if (
    !descValue &&
    desc.lastCandidate &&
    desc.rejectionReason?.startsWith("desc-too-long")
  ) {
    descValue = repairCityMetaDescriptionLength(desc.lastCandidate, input.brand, input.cityName);
  }

  if (!descValue) {
    return {
      ...base,
      status: "llm-failed",
      title: null,
      description: null,
      metaSource: null,
      rejectionReason: `desc:${desc.rejectionReason}`,
      tokensUsed,
      costUsd: Number(costUsd.toFixed(6)),
    };
  }

  // Step 2 — TITLE second (mini: ≤65, city verbatim, no brand — easy), aligned
  // to the approved description.
  const title = await runTwoShot(
    client,
    TITLE_MODEL,
    "title",
    titleSystemPrompt(),
    titleUserPrompt(input, descValue),
    (c) => cityMetaTitleAcceptable(c, input.brand, input.cityName),
    (candidate, reason) => titleRetryHint(candidate, reason, input),
  );
  tokensUsed += title.promptTokens + title.completionTokens;
  costUsd += costFor(TITLE_MODEL, title.promptTokens, title.completionTokens);

  if (!title.value) {
    return {
      ...base,
      status: "llm-failed",
      title: null,
      description: null,
      metaSource: null,
      rejectionReason: `title:${title.rejectionReason}`,
      tokensUsed,
      costUsd: Number(costUsd.toFixed(6)),
    };
  }

  return {
    ...base,
    status: "generated",
    title: title.value,
    description: descValue,
    metaSource: "llm",
    rejectionReason: null,
    tokensUsed,
    costUsd: Number(costUsd.toFixed(6)),
  };
}

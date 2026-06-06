import OpenAI from "openai";

/**
 * Article meta generator — the ONE job: an LLM reads the finished article and
 * writes a Meta Title + Meta Description. No formula glue, no multi-tier
 * fallback. If the LLM can't produce output that passes the (deliberately
 * minimal) hard gates after a few tries, we return status "needs-meta" so the
 * caller can flag the article — we NEVER ship a deterministic glue string.
 *
 * Conductor rules (the ONLY hard gates):
 *   TITLE
 *     - hard max 65 chars (aim 55-60)
 *     - city optional (nice to have, never required)
 *     - brand neither required nor banned
 *   DESCRIPTION
 *     - hard ceiling 320 chars (aim ~300; may run past 300 only to finish a
 *       sentence, so the gate is the 320 ceiling, not 300)
 *     - brand MUST be injected — no exceptions
 *     - ~80% pain point / 20% brand (a writing instruction, not a hard gate)
 *     - city optional but preferred
 *     - no minimum length floor
 */

const MODEL = "gpt-4.1";

export const ARTICLE_META_LIMITS = {
  titleHardMax: 65,
  titleTarget: 58,
  descHardMax: 320,
  descTarget: 300,
} as const;

export interface ArticleMetaBrand {
  /** Brand / persona display name. MUST be injected into the description. */
  personaDisplayName: string;
  brandVertical?: string;
  brandTagline?: string;
}

export interface GenerateArticleMetaInput {
  /** The article H1 / headline, for context. */
  articleTitle: string;
  /** The finished article body (HTML or plain text). Stripped + truncated here. */
  articleBody: string;
  /** Optional — included naturally if present; never required. */
  cityName?: string | null;
  brand: ArticleMetaBrand;
  /** Override knobs (default to ARTICLE_META_LIMITS). */
  titleHardMax?: number;
  descHardMax?: number;
  maxAttempts?: number;
}

export type ArticleMetaStatus = "ok" | "needs-meta";

export interface GenerateArticleMetaResult {
  status: ArticleMetaStatus;
  /** On "ok": the accepted strings. On "needs-meta": the last attempt (for visibility) or null. */
  title: string | null;
  description: string | null;
  attempts: number;
  /** null on success; the last hard-gate failure reason on "needs-meta". */
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
  // gpt-4.1 pricing: $2.00 / 1M input, $8.00 / 1M output.
  return Number(((promptTokens / 1_000_000) * 2.0 + (completionTokens / 1_000_000) * 8.0).toFixed(6));
}

export function stripToPlainText(html: string | null | undefined, maxChars = 6000): string {
  if (!html) return "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? slice.slice(0, lastSpace) : slice;
}

function brandRegex(brand: string): RegExp {
  const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i");
}

/** The ONLY hard title gate: length. Returns null when acceptable. */
export function titleRejectionReason(title: string | null | undefined, hardMax: number): string | null {
  if (!title || !title.trim()) return "title-empty";
  if (title.length > hardMax) return `title-too-long-${title.length}`;
  return null;
}

/** Hard description gates: ceiling + brand present. Returns null when acceptable. */
export function descriptionRejectionReason(
  desc: string | null | undefined,
  brand: string,
  hardMax: number,
): string | null {
  if (!desc || !desc.trim()) return "desc-empty";
  if (desc.length > hardMax) return `desc-too-long-${desc.length}`;
  if (brand.trim().length > 0 && !brandRegex(brand).test(desc)) return "desc-missing-brand";
  return null;
}

function buildSystemPrompt(titleHardMax: number, descHardMax: number): string {
  return `You are an SEO meta-tag writer for a local-market business press-release publisher. You will be given the full text of a finished article. Read it, then write its SERP <title> and meta description.

Work IN THIS ORDER — DESCRIPTION first (it carries the substance), THEN a TITLE whose hook is drawn from that description.

DESCRIPTION:
- Shape it ~80% content / ~20% brand. The ~80% is the real pain point or problem taken from the article. The ~20% is the brand presented as THE SOLUTION to that exact problem.
- The cause-and-effect must connect: state the problem, then name the brand as the thing that solves it. The brand is NOT a generic capability credited at the end — it IS the fix for the pain point you just described. Do not describe a generic solution and then tack the brand on; make the brand the subject that resolves the problem (e.g. "...[brand] fixes this by ...", "[brand] turns that around by ...").
- LEAD with the pain point or story. The brand earns its mention as the solution near the END — never as the opening words.
- The brand name MUST appear (this is mandatory). Mention it once, twice at most.
- Aim for about ${ARTICLE_META_LIMITS.descTarget} characters. Hard ceiling is ${descHardMax} characters — never exceed it. You may finish a sentence rather than cut it short.
- Complete sentences only. No emojis, no hashtags, no markdown, no surrounding quotes.

TITLE:
- A tight hook on the SAME angle as the description. Do not introduce a topic the description didn't raise.
- Aim ${ARTICLE_META_LIMITS.titleTarget} characters; hard maximum ${titleHardMax}. Shorter is better — Google truncates around 60.
- Single line. No emojis, no hashtags, no wrapping quotes, no trailing punctuation except an optional period.

Universal:
- American English, plain, addressed to founders/operators.
- Do NOT invent facts or statistics. Stay within the article's content.
- Mentioning the city is optional — include it only if it reads naturally; never force it.

Return STRICT JSON ONLY (no prose, no code fences):
{ "description": "...", "title": "..." }`;
}

function buildUserPrompt(input: GenerateArticleMetaInput, body: string): string {
  const cityLine = input.cityName ? `City (optional to mention, only if natural): ${input.cityName}\n` : "";
  const verticalLine = input.brand.brandVertical ? `Brand vertical: ${input.brand.brandVertical}\n` : "";
  const taglineLine = input.brand.brandTagline ? `Brand tagline (tone only, do not copy): ${input.brand.brandTagline}\n` : "";
  return `Brand name (MUST appear in the description near the end, presented as THE SOLUTION to the article's problem, once or twice): ${input.brand.personaDisplayName}
${cityLine}${verticalLine}${taglineLine}
Article headline:
${input.articleTitle}

Article body:
${body}

Produce the JSON now.`;
}

function parseStrictJson(raw: string): { title: string; description: string } | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && typeof obj.title === "string" && typeof obj.description === "string") {
      return { title: obj.title.trim(), description: obj.description.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Read the article, generate Meta Title + Meta Description, validate against the
 * minimal hard gates, and retry (feeding back the rejection reason) up to
 * maxAttempts. Never throws for content reasons and never returns formula glue:
 * on total failure it returns status "needs-meta" with the last attempt so a
 * human can see what happened.
 */
export async function generateArticleMeta(
  input: GenerateArticleMetaInput,
): Promise<GenerateArticleMetaResult> {
  const titleHardMax = input.titleHardMax ?? ARTICLE_META_LIMITS.titleHardMax;
  const descHardMax = input.descHardMax ?? ARTICLE_META_LIMITS.descHardMax;
  const maxAttempts = input.maxAttempts ?? 3;
  const body = stripToPlainText(input.articleBody, 6000);

  const empty: GenerateArticleMetaResult = {
    status: "needs-meta",
    title: null,
    description: null,
    attempts: 0,
    rejectionReason: null,
    model: MODEL,
    tokensUsed: 0,
    costUsd: 0,
  };

  let client: OpenAI;
  try {
    client = getClient();
  } catch (err) {
    return { ...empty, rejectionReason: `no-api-key:${(err as Error).message}` };
  }

  const TEMPS = [0.6, 0.35, 0.2];
  let promptTokens = 0;
  let completionTokens = 0;
  let lastParsed: { title: string; description: string } | null = null;
  let lastReason: string | null = null;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(titleHardMax, descHardMax) },
    { role: "user", content: buildUserPrompt(input, body) },
  ];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let raw: string;
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: TEMPS[attempt] ?? 0.2,
        response_format: { type: "json_object" },
        messages,
      });
      raw = completion.choices?.[0]?.message?.content ?? "";
      promptTokens += completion.usage?.prompt_tokens ?? 0;
      completionTokens += completion.usage?.completion_tokens ?? 0;
    } catch (err) {
      return {
        ...empty,
        attempts: attempt + 1,
        tokensUsed: promptTokens + completionTokens,
        costUsd: costFor(promptTokens, completionTokens),
        title: lastParsed?.title ?? null,
        description: lastParsed?.description ?? null,
        rejectionReason: `openai-error:${(err as Error).message}`,
      };
    }

    const parsed = parseStrictJson(raw);
    if (!parsed) {
      lastReason = "json-parse-failed";
      if (attempt < maxAttempts - 1) {
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `That was not valid JSON. Return STRICT JSON only — no prose, no code fences — in the shape { "description": "...", "title": "..." }.`,
        });
      }
      continue;
    }
    lastParsed = parsed;

    const tReason = titleRejectionReason(parsed.title, titleHardMax);
    const dReason = descriptionRejectionReason(parsed.description, input.brand.personaDisplayName, descHardMax);
    if (!tReason && !dReason) {
      return {
        status: "ok",
        title: parsed.title,
        description: parsed.description,
        attempts: attempt + 1,
        rejectionReason: null,
        model: MODEL,
        tokensUsed: promptTokens + completionTokens,
        costUsd: costFor(promptTokens, completionTokens),
      };
    }

    lastReason = [tReason, dReason].filter(Boolean).join("; ");
    if (attempt < maxAttempts - 1) {
      messages.push({ role: "assistant", content: JSON.stringify(parsed) });
      messages.push({
        role: "user",
        content: `Rejected for: ${lastReason}. Fix it. DESCRIPTION: must include the brand name "${input.brand.personaDisplayName}" near the end, presented as THE SOLUTION to the problem (not a generic fix credited at the end), and be at most ${descHardMax} characters (aim ~${ARTICLE_META_LIMITS.descTarget}). TITLE: at most ${titleHardMax} characters (aim ~${ARTICLE_META_LIMITS.titleTarget}). Keep it grounded in the article. Return STRICT JSON only.`,
      });
    }
  }

  return {
    status: "needs-meta",
    title: lastParsed?.title ?? null,
    description: lastParsed?.description ?? null,
    attempts: maxAttempts,
    rejectionReason: lastReason ?? "unknown",
    model: MODEL,
    tokensUsed: promptTokens + completionTokens,
    costUsd: costFor(promptTokens, completionTokens),
  };
}

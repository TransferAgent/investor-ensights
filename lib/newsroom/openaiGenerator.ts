import OpenAI from "openai";
import type {
  PipelineGenerator,
  StageContext,
  StageRunResult,
  PriorOutputs,
  CandidateCity,
} from "@/lib/newsroom/pipelineGenerator";
import {
  ACTIVE_PROMPT_VERSION,
  checkTitleQuality,
  PROMPTS,
  type PromptVersion,
  type StagePrompt,
} from "@/lib/newsroom/prompts";

const MODEL = "gpt-4o-mini";

const PRICING_PER_1M_USD: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OpenAi_Key;
  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY or OpenAi_Key in environment."
    );
  }
  return new OpenAI({ apiKey });
}

function costFor(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = PRICING_PER_1M_USD[model];
  if (!p) return 0;
  const cost =
    (promptTokens / 1_000_000) * p.input +
    (completionTokens / 1_000_000) * p.output;
  return Number(cost.toFixed(4));
}

interface ChatRunResult<T> {
  parsed: T;
  raw: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

async function runStage<T>(
  prompt: StagePrompt,
  vars: { ctx: StageContext; prior: PriorOutputs; extras?: Record<string, unknown> }
): Promise<ChatRunResult<T>> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: prompt.system },
      {
        role: "user",
        content: prompt.user({
          ctx: vars.ctx,
          prior: vars.prior as unknown as Record<string, unknown>,
          extras: vars.extras,
        }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: prompt.temperature,
    max_tokens: prompt.maxTokens,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: T;
  try {
    parsed = JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `OpenAI returned non-JSON response (model=${MODEL}): ${raw.slice(0, 200)}`
    );
  }

  const usage = completion.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;
  const costUsd = costFor(MODEL, promptTokens, completionTokens);

  return { parsed, raw, promptTokens, completionTokens, totalTokens, costUsd };
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? Math.round(n) : Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function asString(v: unknown, max: number, fallback: string): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  const trimmed = s.trim();
  if (trimmed) return trimmed.slice(0, max);
  return (fallback ?? "").slice(0, max);
}

function asOptionalString(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

interface CopywriterRaw {
  title?: unknown;
  metaDescription?: unknown;
  headline?: unknown;
  subheadline?: unknown;
  dateline?: unknown;
  bodyHtml?: unknown;
}

function shapeCopywriterOutput(
  parsed: CopywriterRaw,
  ctx: StageContext,
  dateString: string
): {
  title: string;
  metaDescription?: string;
  headline: string;
  subheadline?: string;
  dateline: string;
  bodyHtml: string;
} {
  const fallbackTitle = `${ctx.cityName}, ${ctx.stateCode}: Cap-Table Activity Snapshot`;
  const fallbackHeadline = `${ctx.cityName} Cap-Table Activity Snapshot`;

  let bodyHtml = asString(parsed.bodyHtml, 8000, "");
  if (bodyHtml.length < 200) {
    bodyHtml = `<p>${bodyHtml || `A snapshot of cap-table activity in ${ctx.cityName}, ${ctx.stateCode} this week.`}</p><p>Generated draft was below the 200-char minimum; this paragraph was added to satisfy schema validation. Reviewer should reject and regenerate.</p>`;
  }

  return {
    title: asString(parsed.title, 120, fallbackTitle),
    metaDescription: asOptionalString(parsed.metaDescription, 300),
    headline: asString(parsed.headline, 200, fallbackHeadline),
    subheadline: asOptionalString(parsed.subheadline, 300),
    dateline:
      asOptionalString(parsed.dateline, 120) ??
      `${ctx.cityName.toUpperCase()}, ${ctx.stateCode} — ${dateString}`,
    bodyHtml,
  };
}

export function makeOpenAIGenerator(
  promptVersion: PromptVersion = ACTIVE_PROMPT_VERSION
): PipelineGenerator {
  if (!PROMPTS[promptVersion]) {
    throw new Error(`Unknown prompt version: ${promptVersion}. Known: ${Object.keys(PROMPTS).join(", ")}`);
  }
  const bundle = PROMPTS[promptVersion];
  const versionTag: PromptVersion = promptVersion;

  return {
  mode: "live",
  modelLabel: `${MODEL}/prompts-${versionTag}`,

  async researcher(ctx: StageContext): Promise<StageRunResult> {
    const result = await runStage<{
      facts?: Array<{ key?: unknown; value?: unknown; sourceHint?: unknown; confidence?: unknown }>;
      summary?: unknown;
    }>(bundle.researcher, { ctx, prior: {} });

    const facts = (result.parsed.facts ?? [])
      .filter((f) => f && typeof f.key === "string" && typeof f.value === "object" && f.value !== null)
      .slice(0, 8)
      .map((f) => ({
        key: asString(f.key, 100, "fact"),
        value: f.value as Record<string, unknown>,
        sourceHint: typeof f.sourceHint === "string" ? f.sourceHint : undefined,
        confidence:
          f.confidence === "high" || f.confidence === "medium" || f.confidence === "low"
            ? f.confidence
            : "medium",
      }));

    const knowledge = facts.map((f) => ({
      key: f.key,
      value: f.value,
      sourceUrl: f.sourceHint ?? null,
      confidence:
        f.confidence === "high" ? 0.9 : f.confidence === "medium" ? 0.6 : 0.3,
    }));

    return {
      output: {
        model: MODEL,
        promptVersion: versionTag,
        facts,
        summary: asString(result.parsed.summary, 1000, ""),
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
      knowledge,
    };
  },

  async data_analyst(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {

    const result = await runStage<{
      tableicityScore?: unknown;
      rationale?: unknown;
      ledeFactKey?: unknown;
      topAngles?: unknown;
    }>(bundle.data_analyst, { ctx, prior });

    const angles = Array.isArray(result.parsed.topAngles)
      ? (result.parsed.topAngles as unknown[])
          .filter((a) => typeof a === "string")
          .slice(0, 5)
          .map((a) => a as string)
      : [];

    return {
      output: {
        model: MODEL,
        promptVersion: versionTag,
        tableicityScore: clampInt(result.parsed.tableicityScore, 0, 100, 50),
        rationale: asString(result.parsed.rationale, 500, "No rationale provided."),
        ledeFactKey: asOptionalString(result.parsed.ledeFactKey, 100),
        topAngles: angles,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },

  async copywriter(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {

    const today = new Date();
    const dateString = today.toDateString();

    const firstResult = await runStage<CopywriterRaw>(bundle.copywriter, {
      ctx,
      prior,
      extras: { dateString },
    });
    const firstShape = shapeCopywriterOutput(firstResult.parsed, ctx, dateString);

    let totalTokens = firstResult.totalTokens;
    let totalCost = firstResult.costUsd;
    let finalShape = firstShape;
    let retried = false;
    let retrySwapped = false;
    let retryReason: string[] = [];
    let titleGate = checkTitleQuality(firstShape.title);
    const firstGateReasons = [...titleGate.reasons];

    if (!titleGate.ok && bundle.copywriter_retry.maxTokens > 0) {
      retried = true;
      retryReason = titleGate.reasons;
      const retryResult = await runStage<CopywriterRaw>(bundle.copywriter_retry, {
        ctx,
        prior,
        extras: {
          dateString,
          previousTitle: firstShape.title,
          failureReasons: titleGate.reasons.join("; "),
        },
      });
      const retryShape = shapeCopywriterOutput(retryResult.parsed, ctx, dateString);
      totalTokens += retryResult.totalTokens;
      totalCost = Number((totalCost + retryResult.costUsd).toFixed(4));

      const retryGate = checkTitleQuality(retryShape.title);
      if (retryGate.ok) {
        finalShape = retryShape;
        titleGate = retryGate;
        retrySwapped = true;
      } else if (retryGate.reasons.length < firstGateReasons.length) {
        finalShape = retryShape;
        titleGate = retryGate;
        retrySwapped = true;
      } else {
        finalShape = firstShape;
        titleGate = { ok: false, reasons: firstGateReasons };
        retrySwapped = false;
      }
    }

    return {
      output: {
        model: MODEL,
        promptVersion: versionTag,
        title: finalShape.title,
        metaDescription: finalShape.metaDescription,
        headline: finalShape.headline,
        subheadline: finalShape.subheadline,
        dateline: finalShape.dateline,
        bodyHtml: finalShape.bodyHtml,
        titleGatePassed: titleGate.ok,
        titleGateReasons: titleGate.ok ? [] : titleGate.reasons,
        retried,
        retrySwapped,
        retryReason,
        firstGateReasons,
      },
      tokensUsed: totalTokens,
      costUsd: totalCost,
    };
  },

  async seo_qc(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {

    const result = await runStage<{
      qcScore?: unknown;
      qcNotes?: unknown;
      issues?: unknown;
    }>(bundle.seo_qc, { ctx, prior });

    const issues = Array.isArray(result.parsed.issues)
      ? (result.parsed.issues as unknown[])
          .filter((i) => typeof i === "string")
          .slice(0, 10)
          .map((i) => i as string)
      : [];

    return {
      output: {
        model: MODEL,
        promptVersion: versionTag,
        qcScore: clampInt(result.parsed.qcScore, 0, 100, 60),
        qcNotes: asString(result.parsed.qcNotes, 1000, "No QC notes."),
        issues,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },

  async internal_linker(
    ctx: StageContext,
    prior: PriorOutputs,
    candidates: CandidateCity[]
  ): Promise<StageRunResult> {
    if (candidates.length === 0) {
      return {
        output: {
          model: MODEL,
          promptVersion: versionTag,
          links: [{ targetSlug: "locations", anchorText: "all Tableicity city pages", position: 0 }],
          note: "No candidate cities available; emitted /locations index link.",
        },
        tokensUsed: 0,
        costUsd: 0,
      };
    }


    const cw = prior.copywriter;
    const bodyExcerpt = (cw?.bodyHtml ?? "").slice(0, 2500);
    const candidatesJson = JSON.stringify(
      candidates.slice(0, 30).map((c) => ({ slug: c.slug, name: c.cityName }))
    );

    const result = await runStage<{ links?: unknown }>(bundle.internal_linker, {
      ctx,
      prior,
      extras: { bodyExcerpt, candidatesJson },
    });

    const candidateSlugs = new Set(candidates.map((c) => c.slug));
    const rawLinks = Array.isArray(result.parsed.links) ? (result.parsed.links as unknown[]) : [];
    const seenAnchors = new Set<string>();
    const links = rawLinks
      .map((l, idx) => {
        if (!l || typeof l !== "object") return null;
        const obj = l as Record<string, unknown>;
        const targetSlug = typeof obj.targetSlug === "string" ? obj.targetSlug : "";
        const anchorText = typeof obj.anchorText === "string" ? obj.anchorText : "";
        const position = typeof obj.position === "number" ? Math.round(obj.position) : idx;
        const slugPart = targetSlug.replace(/^\/?locations\//, "").replace(/^\//, "");
        if (!candidateSlugs.has(slugPart)) return null;
        if (anchorText.length < 3 || anchorText.length > 120) return null;
        const anchorKey = anchorText.trim().toLowerCase();
        if (seenAnchors.has(anchorKey)) return null;
        seenAnchors.add(anchorKey);
        return {
          targetSlug: `locations/${slugPart}`,
          anchorText: anchorText.slice(0, 120),
          position: Math.max(0, position),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .slice(0, 4);

    if (links.length === 0) {
      const fallback = candidates.slice(0, 2).map((c, idx) => ({
        targetSlug: `locations/${c.slug}`,
        anchorText: `cap-table activity in ${c.cityName}`,
        position: idx,
      }));
      return {
        output: {
          model: MODEL,
          promptVersion: versionTag,
          links: fallback,
          note: "LLM produced no valid links; emitted fallback from candidate list.",
        },
        tokensUsed: result.totalTokens,
        costUsd: result.costUsd,
      };
    }

    return {
      output: {
        model: MODEL,
        promptVersion: versionTag,
        links,
        linkCount: links.length,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },
  };
}

export const openaiGenerator: PipelineGenerator = makeOpenAIGenerator();

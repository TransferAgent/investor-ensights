import OpenAI from "openai";
import type {
  PipelineGenerator,
  StageContext,
  StageRunResult,
  PriorOutputs,
  CandidateCity,
} from "@/lib/newsroom/pipelineGenerator";

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

async function runJsonChat<T>(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatRunResult<T>> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1500,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: T;
  try {
    parsed = JSON.parse(raw) as T;
  } catch (err) {
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

export const openaiGenerator: PipelineGenerator = {
  mode: "live",
  modelLabel: MODEL,

  async researcher(ctx: StageContext): Promise<StageRunResult> {
    const system = [
      "You are a hyper-local research agent for the Tableicity Newsroom (cap-table SaaS).",
      "Surface verifiable, recent (2023-2026) facts about the target city's startup, fintech, and small-company financing ecosystem.",
      "Be honest about uncertainty: mark `confidence` as 'high', 'medium', or 'low'.",
      "Return ONLY a JSON object matching the schema below.",
    ].join(" ");

    const user = [
      `Research the startup and small-company fintech ecosystem of ${ctx.cityName}, ${ctx.stateCode}.`,
      "",
      "Return JSON with this exact shape:",
      `{`,
      `  "facts": [`,
      `    { "key": "snake_case_label", "value": { ...small structured object... }, "sourceHint": "brief domain or org", "confidence": "high"|"medium"|"low" }`,
      `  ],`,
      `  "summary": "1-2 sentence ecosystem snapshot"`,
      `}`,
      "",
      "Provide 3-5 facts. Examples of `value`:",
      `  {"population": 206000, "year": 2024}`,
      `  {"sector": "edtech", "active_startup_count": 47, "quarter": "2026-Q1"}`,
      `  {"name": "${ctx.cityName} University", "employees": 8500, "sector": "education"}`,
    ].join("\n");

    const result = await runJsonChat<{
      facts?: Array<{
        key?: unknown;
        value?: unknown;
        sourceHint?: unknown;
        confidence?: unknown;
      }>;
      summary?: unknown;
    }>({ systemPrompt: system, userPrompt: user, maxTokens: 1200 });

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
        facts,
        summary: asString(result.parsed.summary, 1000, ""),
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
      knowledge,
    };
  },

  async data_analyst(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {
    const system = [
      "You are a fact-checker and entity-resolution analyst for Tableicity.",
      "You score the city's cap-table-readiness 0-100 and identify the strongest narrative angles for a press release.",
      "Return ONLY a JSON object.",
    ].join(" ");

    const user = [
      `City: ${ctx.cityName}, ${ctx.stateCode}.`,
      `Researcher facts: ${JSON.stringify(prior.researcher?.facts ?? [])}`,
      "",
      "Return JSON:",
      `{ "tableicityScore": <0-100 integer>, "rationale": "1-2 sentences", "topAngles": ["angle 1", "angle 2", "angle 3"] }`,
      "",
      "Score rubric: 0-30 = thin/unknown, 30-60 = developing, 60-80 = solid corridor, 80-100 = exceptional.",
    ].join("\n");

    const result = await runJsonChat<{
      tableicityScore?: unknown;
      rationale?: unknown;
      topAngles?: unknown;
    }>({ systemPrompt: system, userPrompt: user, maxTokens: 800 });

    const angles = Array.isArray(result.parsed.topAngles)
      ? (result.parsed.topAngles as unknown[])
          .filter((a) => typeof a === "string")
          .slice(0, 5)
          .map((a) => a as string)
      : [];

    return {
      output: {
        model: MODEL,
        tableicityScore: clampInt(result.parsed.tableicityScore, 0, 100, 50),
        rationale: asString(result.parsed.rationale, 500, "No rationale provided."),
        topAngles: angles,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },

  async copywriter(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {
    const system = [
      "You are a city-native fintech journalist for Tableicity (cap-table SaaS at tableicity.com).",
      "Write press releases in plain HTML (no markdown, no <html>/<body> wrapper).",
      "Allowed tags: <p>, <h2>, <ul>, <li>, <strong>, <em>, <a>.",
      "Voice: blunt, factual, helpful — never breathless. Use real local anchors from the research, not generic landmarks.",
      "Audience: founders in the city who might use Tableicity.",
      "Return ONLY a JSON object.",
    ].join(" ");

    const today = new Date();
    const dateString = today.toDateString();

    const user = [
      `Write a Newsroom press release for ${ctx.cityName}, ${ctx.stateCode}.`,
      `Today's date: ${dateString}.`,
      `Researcher facts: ${JSON.stringify(prior.researcher?.facts ?? [])}`,
      `Analyst rationale: ${prior.data_analyst?.rationale ?? ""}`,
      `Suggested angles: ${JSON.stringify(prior.data_analyst?.topAngles ?? [])}`,
      "",
      "Return JSON with this exact shape:",
      `{`,
      `  "title": "10-120 chars, must include city name",`,
      `  "metaDescription": "40-300 chars",`,
      `  "headline": "the H1, 10+ chars",`,
      `  "subheadline": "1 sentence",`,
      `  "dateline": "${ctx.cityName.toUpperCase()}, ${ctx.stateCode} — ${dateString}",`,
      `  "bodyHtml": "200-2500 chars, valid HTML, 4-6 paragraphs, one <h2> mid-article, close with a brief Tableicity CTA paragraph"`,
      `}`,
    ].join("\n");

    const result = await runJsonChat<{
      title?: unknown;
      metaDescription?: unknown;
      headline?: unknown;
      subheadline?: unknown;
      dateline?: unknown;
      bodyHtml?: unknown;
    }>({ systemPrompt: system, userPrompt: user, maxTokens: 1800, temperature: 0.6 });

    const fallbackTitle = `${ctx.cityName} Fintech Pulse: Cap-Table Activity in the ${ctx.stateCode} Metro`;
    const fallbackHeadline = `${ctx.cityName} Fintech Pulse — Week of ${today.toISOString().slice(0, 10)}`;

    let bodyHtml = asString(result.parsed.bodyHtml, 8000, "");
    if (bodyHtml.length < 200) {
      bodyHtml = `<p>${bodyHtml || `A snapshot of cap-table activity in ${ctx.cityName}, ${ctx.stateCode} this week.`}</p><p>Generated draft was below the 200-char minimum; this paragraph was added to satisfy schema validation. Reviewer should reject and regenerate.</p>`;
    }

    return {
      output: {
        model: MODEL,
        title: asString(result.parsed.title, 120, fallbackTitle),
        metaDescription: asOptionalString(result.parsed.metaDescription, 300),
        headline: asString(result.parsed.headline, 200, fallbackHeadline),
        subheadline: asOptionalString(result.parsed.subheadline, 300),
        dateline: asOptionalString(result.parsed.dateline, 120) ??
          `${ctx.cityName.toUpperCase()}, ${ctx.stateCode} — ${dateString}`,
        bodyHtml,
      },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },

  async seo_qc(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult> {
    const system = [
      "You are an SEO auditor for Tableicity Newsroom.",
      "Score the draft 0-100 against: title quality, H1 strength, body depth, factual specificity, internal-link readiness, anchor naturalness, and duplicate-content risk vs other Tableicity city pages.",
      "Return ONLY a JSON object.",
    ].join(" ");

    const cw = prior.copywriter;
    const user = [
      `Audit this Newsroom draft for ${ctx.cityName}, ${ctx.stateCode}.`,
      `title: ${cw?.title ?? ""}`,
      `headline: ${cw?.headline ?? ""}`,
      `metaDescription: ${cw?.metaDescription ?? ""}`,
      `bodyHtml: ${(cw?.bodyHtml ?? "").slice(0, 4000)}`,
      "",
      "Return JSON:",
      `{ "qcScore": <0-100 integer>, "qcNotes": "1-3 sentences", "issues": ["specific issue 1", ...] }`,
      "",
      "Pass threshold is 70. Empty issues array means clean.",
    ].join("\n");

    const result = await runJsonChat<{
      qcScore?: unknown;
      qcNotes?: unknown;
      issues?: unknown;
    }>({ systemPrompt: system, userPrompt: user, maxTokens: 600, temperature: 0.2 });

    const issues = Array.isArray(result.parsed.issues)
      ? (result.parsed.issues as unknown[])
          .filter((i) => typeof i === "string")
          .slice(0, 10)
          .map((i) => i as string)
      : [];

    return {
      output: {
        model: MODEL,
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
          links: [{ targetSlug: "locations", anchorText: "all Tableicity city pages", position: 0 }],
          note: "No candidate cities available; emitted /locations index link.",
        },
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    const system = [
      "You are an internal-link recommender for Tableicity Newsroom.",
      "Pick 2-5 contextual internal links from the candidate list to insert into the article.",
      "Anchor text must be 3-10 words, descriptive, and natural in context.",
      "NEVER invent slugs. Only use slugs from the provided candidate list.",
      "Return ONLY a JSON object.",
    ].join(" ");

    const cw = prior.copywriter;
    const bodyExcerpt = (cw?.bodyHtml ?? "").slice(0, 2500);
    const candidatesJson = JSON.stringify(
      candidates.slice(0, 30).map((c) => ({ slug: c.slug, name: c.cityName }))
    );

    const user = [
      `Article city: ${ctx.cityName}, ${ctx.stateCode}.`,
      `Article body excerpt: ${bodyExcerpt}`,
      `Candidate target slugs (Tableicity city pages): ${candidatesJson}`,
      "",
      "Return JSON:",
      `{ "links": [ { "targetSlug": "locations/<slug>", "anchorText": "3-10 words", "position": <1-based ordinal in body> } ] }`,
      "",
      "Pick 2-5 links. Prefix every targetSlug with 'locations/' followed by a candidate slug (e.g. 'locations/boston-ma').",
    ].join("\n");

    const result = await runJsonChat<{ links?: unknown }>({
      systemPrompt: system,
      userPrompt: user,
      maxTokens: 600,
      temperature: 0.3,
    });

    const candidateSlugs = new Set(candidates.map((c) => c.slug));
    const rawLinks = Array.isArray(result.parsed.links) ? (result.parsed.links as unknown[]) : [];
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
        return {
          targetSlug: `locations/${slugPart}`,
          anchorText: anchorText.slice(0, 120),
          position: Math.max(0, position),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .slice(0, 5);

    if (links.length === 0) {
      const fallback = candidates.slice(0, 2).map((c, idx) => ({
        targetSlug: `locations/${c.slug}`,
        anchorText: `cap-table activity in ${c.cityName}`,
        position: idx,
      }));
      return {
        output: {
          model: MODEL,
          links: fallback,
          note: "LLM produced no valid links; emitted fallback from candidate list.",
        },
        tokensUsed: result.totalTokens,
        costUsd: result.costUsd,
      };
    }

    return {
      output: { model: MODEL, links, linkCount: links.length },
      tokensUsed: result.totalTokens,
      costUsd: result.costUsd,
    };
  },
};

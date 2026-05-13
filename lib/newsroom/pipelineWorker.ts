import { db } from "@/lib/db";
import {
  newsroomAgents,
  newsroomPipelineJobs,
  newsroomAgentRuns,
  newsroomAgentKnowledge,
  newsroomReviewQueue,
  newsroomInternalLinkSuggestions,
  cityLocations,
  type NewsroomAgent,
} from "@shared/schema";
import { and, eq, ne } from "drizzle-orm";
import { ensureDefaultAgents } from "@/lib/newsroom";
import {
  newsroomDraftPayloadV1Schema,
  type NewsroomDraftPayloadV1,
} from "@/lib/newsroom/draftPayload";
import {
  composeDraftFromOutputs,
  type CandidateCity,
  type PipelineGenerator,
  type PriorOutputs,
  type StageContext,
  type StageRole,
  type StageRunResult,
  type AnalystOutput,
  type CopywriterOutput,
  type LinkerOutput,
  type QcOutput,
  type ResearcherOutput,
} from "@/lib/newsroom/pipelineGenerator";
import { fixtureGenerator } from "@/lib/newsroom/fixtureGenerator";
import { makeOpenAIGenerator, openaiGenerator } from "@/lib/newsroom/openaiGenerator";
import { ACTIVE_PROMPT_VERSION, PROMPTS, type PromptVersion } from "@/lib/newsroom/prompts";
import { sanitizeNewsroomHtml, sanitizeNewsroomPlaintext } from "@/lib/newsroom/htmlSanitizer";
import { normalizeHayloBody } from "@/lib/newsroom/hayloBodyNormalizer";
import { resolveBrandContext, type BrandContext } from "@/lib/newsroom/brandContext";
import { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } from "@/lib/tenant/context";

const STAGE_ORDER: StageRole[] = [
  "researcher",
  "data_analyst",
  "copywriter",
  "seo_qc",
  "internal_linker",
];

const STAGE_GROUPS: StageRole[][] = [
  ["researcher"],
  ["data_analyst"],
  ["copywriter"],
  ["seo_qc", "internal_linker"],
];

interface StageBookkeepingResult {
  role: StageRole;
  output: unknown;
  tokensUsed: number;
  costUsd: number;
}

async function runStageWithBookkeeping(args: {
  role: StageRole;
  agent: NewsroomAgent;
  ctx: StageContext;
  prior: PriorOutputs;
  jobId: string;
  citySlug: string;
  cityName: string;
  stateCode: string;
  dryRun: boolean;
  generator: PipelineGenerator;
  completedRoles: StageRole[];
  candidatesForLinker?: CandidateCity[];
}): Promise<StageBookkeepingResult> {
  const {
    role, agent, ctx, prior, jobId, citySlug, cityName, stateCode,
    dryRun, generator, completedRoles, candidatesForLinker,
  } = args;

  const startedAt = new Date();
  const stageInput: Record<string, unknown> = {
    citySlug,
    cityName,
    stateCode,
    stage: role,
    priorStages: [...completedRoles],
  };

  let stageResult: StageRunResult;
  if (role === "researcher") {
    stageResult = await generator.researcher(ctx);
  } else if (role === "data_analyst") {
    stageInput.researcherFacts = prior.researcher?.facts ?? [];
    stageResult = await generator.data_analyst(ctx, prior);
  } else if (role === "copywriter") {
    stageInput.researcherFacts = prior.researcher?.facts ?? [];
    stageInput.analystAngles = prior.data_analyst?.topAngles ?? [];
    stageResult = await generator.copywriter(ctx, prior);
  } else if (role === "seo_qc") {
    stageInput.draft = {
      title: prior.copywriter?.title,
      headline: prior.copywriter?.headline,
      bodyChars: (prior.copywriter?.bodyHtml ?? "").length,
    };
    stageResult = await generator.seo_qc(ctx, prior);
  } else {
    const cands = candidatesForLinker ?? [];
    stageInput.candidateCount = cands.length;
    stageResult = await generator.internal_linker(ctx, prior, cands);
  }

  const finishedAt = new Date();
  await db.insert(newsroomAgentRuns).values({
    agentId: agent.id,
    jobId,
    citySlug,
    status: "completed",
    dryRun,
    input: stageInput,
    output: stageResult.output,
    tokensUsed: stageResult.tokensUsed,
    costUsd: String(stageResult.costUsd),
    startedAt,
    finishedAt,
  });

  if (stageResult.knowledge && stageResult.knowledge.length > 0) {
    await db.insert(newsroomAgentKnowledge).values(
      stageResult.knowledge.map((k) => ({
        agentId: agent.id,
        citySlug,
        key: k.key,
        value: k.value,
        sourceUrl: k.sourceUrl ?? null,
        confidence: k.confidence != null ? String(k.confidence) : null,
      }))
    );
  }

  return {
    role,
    output: stageResult.output,
    tokensUsed: stageResult.tokensUsed,
    costUsd: stageResult.costUsd,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * MT-4.13.2: brand-mention guard. The public article renderer
 * (`app/discovery/knowledge/[slug]/page.tsx::highlightBrandInBody`) wraps the
 * FIRST occurrence of `tenants.persona_display_name` in the body with the
 * brand-home backlink (`tenants.brand_home_url`, `{cityCore}` swapped for the
 * article's city slug). If the LLM never weaves the persona name into a
 * linkable body location, that backlink silently disappears — which is how
 * the two May-2026 Tableicity articles shipped without a back-link to
 * tableicity.com/locations/<city>.
 *
 * This guard is the single systemic fix: the pipeline fails the run BEFORE
 * the draft is composed and persisted, so we never ship a brand-less article
 * again.
 *
 * Tokenization mirrors `highlightBrandInBody` EXACTLY so a guard pass
 * guarantees a render-time link:
 *   - Split on `(<[^>]*>)` so tag content (attributes like
 *     `href="https://tableicity.com"`, `title="Tableicity"`) is never
 *     scanned — only visible text tokens are.
 *   - Skip text inside an open `<a>` (renderer won't double-wrap an anchor).
 *   - Skip text inside `<p class="answer-block">` blocks (renderer skips
 *     them so the link doesn't land in the visually-hidden duplicates).
 *   - Word-boundary, case-insensitive match on the persona name.
 */
function bodyMentionsBrand(html: string, brandName: string): boolean {
  if (!brandName) return true;
  const re = new RegExp(`\\b${escapeRegex(brandName)}\\b`, "i");
  let inAnchor = false;
  let answerBlockDepth = 0;
  const tokens = html.split(/(<[^>]*>)/);
  for (const token of tokens) {
    if (token.startsWith("<")) {
      if (/^<a[\s>]/i.test(token)) inAnchor = true;
      else if (/^<\/a>/i.test(token)) inAnchor = false;
      else if (/^<p\b[^>]*\bclass=["'][^"']*\banswer-block\b/i.test(token)) answerBlockDepth++;
      else if (/^<\/p>/i.test(token) && answerBlockDepth > 0) answerBlockDepth--;
      continue;
    }
    if (inAnchor || answerBlockDepth > 0) continue;
    if (re.test(token)) return true;
  }
  return false;
}

function titleCaseFromSlug(slug: string): string {
  const parts = slug.split("-");
  if (parts.length === 0) return slug;
  const stateMaybe = parts[parts.length - 1];
  const isStateCode = stateMaybe.length === 2;
  const namePart = isStateCode ? parts.slice(0, -1) : parts;
  const name = namePart
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return isStateCode ? `${name}, ${stateMaybe.toUpperCase()}` : name;
}

export interface PipelineRunResult {
  mode: "fixture" | "live";
  modelLabel: string;
  jobId: string;
  /** null when skipReviewQueue=true (caller owns saving destination) */
  reviewQueueId: string | null;
  stagesCompleted: StageRole[];
  draftSummary: {
    title: string;
    suggestedSlug: string;
    bodyChars: number;
    internalLinks: number;
    qcScore: number;
  };
  /** Full v1-validated draft payload (for callers that own their own saving). */
  draftPayload: NewsroomDraftPayloadV1;
  /** SEO QC issues (empty array if none). */
  qcIssues: string[];
  /** SEO QC notes string. */
  qcNotes: string;
  /** Internal-link suggestions emitted by the linker stage. */
  links: LinkerOutput["links"];
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

export interface RunPipelineOpts {
  citySlug: string;
  username: string;
  generator: PipelineGenerator;
  dryRun: boolean;
  source?: string;
  /**
   * Polish-mode seed (Pair flow). When provided, the Copywriter writes only a
   * city-localized opening lede; pipelineWorker stitches the normalized Haylo
   * body after it before SEO QC scores the full draft. Should be used only
   * with promptVersion="v4".
   */
  hayloSeed?: {
    title: string;
    bodyHtml: string;
    topicSlug?: string | null;
  };
  /**
   * MT-4.12: brand context for the active tenant. Optional; if omitted,
   * runPipeline resolves it from the current AsyncLocalStorage tenant slug
   * (falling back to DEFAULT_TENANT_SLUG). Threaded into StageContext so
   * every prompt and the final compose step renders in the persona's voice.
   */
  brand?: BrandContext;
  /**
   * When true, runPipeline skips inserting into newsroom_review_queue (and the
   * link-suggestions table). The caller is then responsible for persisting the
   * draft (e.g. into knowledge_articles) using the draftPayload returned in the
   * result. Used by the Pair-agent orchestrator so PASS verdicts go straight
   * to knowledge_articles instead of cluttering the review queue.
   */
  skipReviewQueue?: boolean;
}

export async function runPipeline(opts: RunPipelineOpts): Promise<PipelineRunResult> {
  const startMs = Date.now();
  const { citySlug, username, generator, dryRun, source, hayloSeed, skipReviewQueue } = opts;
  // MT-4.12: resolve brand once per run; passed into ctx and the final compose step.
  const brand =
    opts.brand ??
    (await resolveBrandContext(getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG));

  const agents = await ensureDefaultAgents();
  const agentByRole = new Map<string, NewsroomAgent>(agents.map((a) => [a.role, a]));
  for (const role of STAGE_ORDER) {
    if (!agentByRole.has(role)) {
      throw new Error(`Default agent missing for role: ${role}`);
    }
  }

  const existingActive = await db
    .select({ id: newsroomPipelineJobs.id, status: newsroomPipelineJobs.status })
    .from(newsroomPipelineJobs)
    .where(
      and(
        eq(newsroomPipelineJobs.citySlug, citySlug),
        eq(newsroomPipelineJobs.dryRun, dryRun),
        ne(newsroomPipelineJobs.status, "completed"),
        ne(newsroomPipelineJobs.status, "failed")
      )
    )
    .limit(1);
  if (existingActive.length > 0) {
    throw new Error(
      `A ${dryRun ? "dry-run" : "live"} job for "${citySlug}" is already ${existingActive[0].status} (id=${existingActive[0].id}). Wait for it to complete or release the lease.`
    );
  }

  const [city] = await db
    .select({
      cityName: cityLocations.cityName,
      stateCode: cityLocations.stateCode,
    })
    .from(cityLocations)
    .where(eq(cityLocations.slug, citySlug))
    .limit(1);
  const cityName = city?.cityName ?? titleCaseFromSlug(citySlug).split(",")[0];
  const stateCode = (city?.stateCode ?? citySlug.split("-").pop() ?? "MA").toUpperCase();

  const [job] = await db
    .insert(newsroomPipelineJobs)
    .values({
      citySlug,
      status: "running",
      currentStage: "researcher",
      dryRun,
      payload: {
        source: source ?? "in-app-pipeline",
        username,
        mode: generator.mode,
        model: generator.modelLabel,
      },
      claimedBy: `in-app-${generator.mode}-worker`,
      claimedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .returning();

  const ctx: StageContext = {
    citySlug,
    cityName,
    stateCode,
    jobId: job.id,
    hayloSeed,
    brand,
  };

  const prior: PriorOutputs = {};
  const completedRoles: StageRole[] = [];
  let totalTokens = 0;
  let totalCostUsd = 0;

  try {
    for (const group of STAGE_GROUPS) {
      let candidatesForLinker: CandidateCity[] | undefined;
      if (group.includes("internal_linker")) {
        candidatesForLinker = await fetchCandidateCities(citySlug);
      }

      const groupResults = await Promise.all(
        group.map((role) =>
          runStageWithBookkeeping({
            role,
            agent: agentByRole.get(role)!,
            ctx,
            prior,
            jobId: job.id,
            citySlug,
            cityName,
            stateCode,
            dryRun,
            generator,
            completedRoles,
            candidatesForLinker:
              role === "internal_linker" ? candidatesForLinker : undefined,
          })
        )
      );

      for (const r of groupResults) {
        switch (r.role) {
          case "researcher":
            prior.researcher = r.output as unknown as ResearcherOutput;
            break;
          case "data_analyst":
            prior.data_analyst = r.output as unknown as AnalystOutput;
            break;
          case "copywriter": {
            const cw = r.output as unknown as CopywriterOutput;
            if (hayloSeed) {
              const lede = (cw.bodyHtml ?? "").trim();
              const normalizedSeed = normalizeHayloBody(hayloSeed.bodyHtml);
              const stitched = lede
                ? `${lede}\n${normalizedSeed}`
                : normalizedSeed;
              prior.copywriter = { ...cw, bodyHtml: stitched };
            } else {
              prior.copywriter = cw;
            }
            break;
          }
          case "seo_qc":
            prior.seo_qc = r.output as unknown as QcOutput;
            break;
          case "internal_linker":
            prior.internal_linker = r.output as unknown as LinkerOutput;
            break;
        }
        totalTokens += r.tokensUsed;
        totalCostUsd += r.costUsd;
        completedRoles.push(r.role);
      }

      const lastRoleInGroup = group[group.length - 1];
      const lastIdx = STAGE_ORDER.indexOf(lastRoleInGroup);
      const nextStage = STAGE_ORDER[lastIdx + 1] ?? "review";

      await db
        .update(newsroomPipelineJobs)
        .set({
          currentStage: nextStage,
          agentsCompleted: [...completedRoles],
          heartbeatAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(newsroomPipelineJobs.id, job.id));
    }

    const linksFromStage = (prior.internal_linker?.links ?? []) as LinkerOutput["links"];

    if (prior.copywriter) {
      const cw = prior.copywriter;
      const sanitized: CopywriterOutput = {
        ...cw,
        title: sanitizeNewsroomPlaintext(cw.title),
        headline: sanitizeNewsroomPlaintext(cw.headline),
        subheadline: cw.subheadline ? sanitizeNewsroomPlaintext(cw.subheadline) : undefined,
        // MT-4.12: sanitize the SERP <title> too.
        metaTitle: cw.metaTitle ? sanitizeNewsroomPlaintext(cw.metaTitle) : undefined,
        metaDescription: cw.metaDescription ? sanitizeNewsroomPlaintext(cw.metaDescription) : undefined,
        dateline: cw.dateline ? sanitizeNewsroomPlaintext(cw.dateline) : undefined,
        bodyHtml: sanitizeNewsroomHtml(cw.bodyHtml),
      };
      prior.copywriter = sanitized;
    }

    // MT-4.13.2: brand-mention guard (see bodyMentionsBrand above).
    if (prior.copywriter && brand?.personaDisplayName) {
      if (!bodyMentionsBrand(prior.copywriter.bodyHtml, brand.personaDisplayName)) {
        throw new Error(
          `Brand-mention guard: body does not contain "${brand.personaDisplayName}" — ` +
          `the public renderer would ship without the brand backlink. ` +
          `Re-run the pipeline (the LLM weaves the brand name on most attempts) ` +
          `or revise the source Haylo essay to mention the brand once.`
        );
      }
    }

    const draft: NewsroomDraftPayloadV1 = composeDraftFromOutputs({
      citySlug,
      prior,
      links: linksFromStage,
      brand,
    });

    const validated = newsroomDraftPayloadV1Schema.safeParse(draft);
    if (!validated.success) {
      throw new Error(
        `Composed draft failed v1 schema validation: ${JSON.stringify(validated.error.flatten())}`
      );
    }

    const qcScore = prior.seo_qc?.qcScore ?? 0;
    const qcNotes = prior.seo_qc?.qcNotes ?? "";
    const qcIssues = prior.seo_qc?.issues ?? [];

    let reviewQueueId: string | null = null;
    if (!skipReviewQueue) {
      const [reviewRow] = await db
        .insert(newsroomReviewQueue)
        .values({
          jobId: job.id,
          citySlug,
          draftPayload: validated.data,
          qcScore,
          qcNotes: `[${generator.mode}/${generator.modelLabel}] ${qcNotes}`.slice(0, 2000),
          status: "pending",
        })
        .returning({ id: newsroomReviewQueue.id });
      reviewQueueId = reviewRow.id;

      if (linksFromStage.length > 0) {
        await db.insert(newsroomInternalLinkSuggestions).values(
          linksFromStage.map((l) => ({
            reviewQueueId: reviewRow.id,
            targetSlug: l.targetSlug,
            anchorText: l.anchorText,
            position: l.position,
            accepted: false,
          }))
        );
      }
    }

    await db
      .update(newsroomPipelineJobs)
      .set({
        status: "completed",
        currentStage: "review",
        agentsCompleted: [...completedRoles],
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsroomPipelineJobs.id, job.id));

    return {
      mode: generator.mode,
      modelLabel: generator.modelLabel,
      jobId: job.id,
      reviewQueueId,
      stagesCompleted: completedRoles,
      draftSummary: {
        title: validated.data.title,
        suggestedSlug: validated.data.suggestedSlug,
        bodyChars: validated.data.bodyHtml.length,
        internalLinks: linksFromStage.length,
        qcScore,
      },
      draftPayload: validated.data,
      qcIssues,
      qcNotes,
      links: linksFromStage,
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    await db
      .update(newsroomPipelineJobs)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsroomPipelineJobs.id, job.id));
    throw err;
  }
}

async function fetchCandidateCities(excludeSlug: string): Promise<CandidateCity[]> {
  const rows = await db
    .select({ slug: cityLocations.slug, cityName: cityLocations.cityName })
    .from(cityLocations)
    .where(and(eq(cityLocations.isPublished, true), ne(cityLocations.slug, excludeSlug)))
    .limit(20);
  return rows.map((r) => ({ slug: r.slug, cityName: r.cityName }));
}

export async function runFixturePipeline(opts: {
  citySlug: string;
  username: string;
}): Promise<PipelineRunResult> {
  return runPipeline({
    citySlug: opts.citySlug,
    username: opts.username,
    generator: fixtureGenerator,
    dryRun: true,
    source: "in-app-fixture",
  });
}

export async function runLivePipeline(opts: {
  citySlug: string;
  username: string;
  dryRun?: boolean;
  promptVersion?: PromptVersion;
}): Promise<PipelineRunResult> {
  const requestedVersion = opts.promptVersion ?? ACTIVE_PROMPT_VERSION;
  if (!PROMPTS[requestedVersion]) {
    throw new Error(
      `Unknown prompt version "${requestedVersion}". Known: ${Object.keys(PROMPTS).join(", ")}`
    );
  }
  const generator =
    requestedVersion === ACTIVE_PROMPT_VERSION
      ? openaiGenerator
      : makeOpenAIGenerator(requestedVersion);

  return runPipeline({
    citySlug: opts.citySlug,
    username: opts.username,
    generator,
    dryRun: opts.dryRun ?? false,
    source: `in-app-live/prompts-${requestedVersion}`,
  });
}

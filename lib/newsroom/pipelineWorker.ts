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
import { openaiGenerator } from "@/lib/newsroom/openaiGenerator";
import { sanitizeNewsroomHtml, sanitizeNewsroomPlaintext } from "@/lib/newsroom/htmlSanitizer";

const STAGE_ORDER: StageRole[] = [
  "researcher",
  "data_analyst",
  "copywriter",
  "seo_qc",
  "internal_linker",
];

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
  reviewQueueId: string;
  stagesCompleted: StageRole[];
  draftSummary: {
    title: string;
    suggestedSlug: string;
    bodyChars: number;
    internalLinks: number;
    qcScore: number;
  };
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
}

export async function runPipeline(opts: RunPipelineOpts): Promise<PipelineRunResult> {
  const startMs = Date.now();
  const { citySlug, username, generator, dryRun, source } = opts;

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
  };

  const prior: PriorOutputs = {};
  const completedRoles: StageRole[] = [];
  let totalTokens = 0;
  let totalCostUsd = 0;

  try {
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const role = STAGE_ORDER[i];
      const agent = agentByRole.get(role)!;
      const nextStage = STAGE_ORDER[i + 1] ?? "review";

      const startedAt = new Date();
      let stageResult: StageRunResult;
      let stageInput: Record<string, unknown> = {
        citySlug,
        cityName,
        stateCode,
        stage: role,
        priorStages: completedRoles,
      };

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
        const candidatesForLinker = await fetchCandidateCities(citySlug);
        stageInput.candidateCount = candidatesForLinker.length;
        stageResult = await generator.internal_linker(ctx, prior, candidatesForLinker);
      }

      switch (role) {
        case "researcher":
          prior.researcher = stageResult.output as unknown as ResearcherOutput;
          break;
        case "data_analyst":
          prior.data_analyst = stageResult.output as unknown as AnalystOutput;
          break;
        case "copywriter":
          prior.copywriter = stageResult.output as unknown as CopywriterOutput;
          break;
        case "seo_qc":
          prior.seo_qc = stageResult.output as unknown as QcOutput;
          break;
        case "internal_linker":
          prior.internal_linker = stageResult.output as unknown as LinkerOutput;
          break;
      }

      const finishedAt = new Date();
      await db.insert(newsroomAgentRuns).values({
        agentId: agent.id,
        jobId: job.id,
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

      totalTokens += stageResult.tokensUsed;
      totalCostUsd += stageResult.costUsd;

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

      completedRoles.push(role);

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
        metaDescription: cw.metaDescription ? sanitizeNewsroomPlaintext(cw.metaDescription) : undefined,
        dateline: cw.dateline ? sanitizeNewsroomPlaintext(cw.dateline) : undefined,
        bodyHtml: sanitizeNewsroomHtml(cw.bodyHtml),
      };
      prior.copywriter = sanitized;
    }

    const draft: NewsroomDraftPayloadV1 = composeDraftFromOutputs({
      citySlug,
      prior,
      links: linksFromStage,
    });

    const validated = newsroomDraftPayloadV1Schema.safeParse(draft);
    if (!validated.success) {
      throw new Error(
        `Composed draft failed v1 schema validation: ${JSON.stringify(validated.error.flatten())}`
      );
    }

    const qcScore = prior.seo_qc?.qcScore ?? 0;
    const qcNotes = prior.seo_qc?.qcNotes ?? "";

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
      reviewQueueId: reviewRow.id,
      stagesCompleted: completedRoles,
      draftSummary: {
        title: validated.data.title,
        suggestedSlug: validated.data.suggestedSlug,
        bodyChars: validated.data.bodyHtml.length,
        internalLinks: linksFromStage.length,
        qcScore,
      },
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
}): Promise<PipelineRunResult> {
  return runPipeline({
    citySlug: opts.citySlug,
    username: opts.username,
    generator: openaiGenerator,
    dryRun: opts.dryRun ?? false,
    source: "in-app-live",
  });
}

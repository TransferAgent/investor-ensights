import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import type { AuditorIssue, AuditorResult, AuditVerdict } from "./auditor";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";
import {
  buildSuggestedSlug,
  processPair,
  type PairInput,
  type PairResult,
} from "./pairProcessor";
import { runPipeline } from "./pipelineWorker";
import { makeOpenAIGenerator } from "./openaiGenerator";
import { ensureCitySources } from "./cityResearchAutoSeeder";
import { resolveBrandContext } from "./brandContext";
import { generateArticleMeta } from "./articleMetaGenerator";
import { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } from "@/lib/tenant/context";

/**
 * PASS / WARN / FAIL thresholds for the multi-agent Pair flow. These mirror
 * the audit verdict shape used by the legacy Glue+grade flow so the
 * enqueue-pairs route's saving logic continues to work unchanged.
 */
const PASS_THRESHOLD = 75;
const WARN_THRESHOLD = 50;

function verdictFromScore(score: number): AuditVerdict {
  if (score >= PASS_THRESHOLD) return "pass";
  if (score >= WARN_THRESHOLD) return "warn";
  return "fail";
}

function qcIssuesToAuditorIssues(qcIssues: string[]): AuditorIssue[] {
  return qcIssues.slice(0, 12).map((message): AuditorIssue => {
    const lower = message.toLowerCase();
    let severity: AuditorIssue["severity"] = "low";
    if (lower.includes("ungrounded") || lower.includes("hallucination") || lower.includes("city-mismatch")) {
      severity = "high";
    } else if (lower.includes("banned") || lower.includes("missing") || lower.includes("title")) {
      severity = "medium";
    }
    let category: AuditorIssue["category"] = "other";
    if (lower.includes("city")) category = "city-mismatch";
    else if (lower.includes("vibe") || lower.includes("flow") || lower.includes("seam")) category = "vibe-flow";
    else if (lower.includes("contradict")) category = "contradiction";
    else if (lower.includes("template") || lower.includes("artifact") || lower.includes("unfilled")) category = "template-artifact";
    else if (lower.includes("tone") || lower.includes("banned") || lower.includes("vibrant") || lower.includes("thriving")) category = "tone";
    return { severity, category, message: message.slice(0, 280) };
  });
}

function buildAuditSummary(verdict: AuditVerdict, qcScore: number, qcNotes: string): string {
  const prefix =
    verdict === "pass"
      ? `Multi-agent pipeline PASS (${qcScore}/100).`
      : verdict === "warn"
        ? `Multi-agent pipeline WARN (${qcScore}/100) — needs human eyes.`
        : `Multi-agent pipeline FAIL (${qcScore}/100) — blocked from publishing.`;
  const trimmedNotes = qcNotes.trim();
  if (!trimmedNotes) return prefix;
  return `${prefix} ${trimmedNotes}`.slice(0, 600);
}

export interface RunPairAgentInput extends PairInput {
  username: string;
}

export async function runPairAgentPipeline(input: RunPairAgentInput): Promise<PairResult> {
  if (input.dryRun) {
    return processPair(input);
  }

  // MT-4.12: resolve brand once for the entire run (used by ctx, meta tier
  // selection, and final author/publisher attribution).
  const brand = await resolveBrandContext(
    getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG,
  );

  const composeInput: ComposeInput = {
    hayloTitle: input.hayloArticle.title,
    hayloBodyHtml: input.hayloArticle.bodyHtml,
    cityName: input.city.cityName,
    stateCode: input.city.stateCode,
    stateName: input.city.stateName ?? null,
    localVibe: input.localVibe ?? null,
    vibeSourceUrl: input.vibeSourceUrl ?? null,
    topicSlug: input.hayloArticle.topicSlug ?? undefined,
  };
  const composed: ComposeResult = composePressRelease(composeInput);

  try {
    await ensureCitySources(input.city.slug);
  } catch (err) {
    console.warn(
      `[pairAgentOrchestrator] ensureCitySources failed for ${input.city.slug}; continuing with whatever sources exist:`,
      err instanceof Error ? err.message : err,
    );
  }

  const generator = makeOpenAIGenerator("v4");
  const pipelineResult = await runPipeline({
    citySlug: input.city.slug,
    username: input.username,
    generator,
    dryRun: false,
    source: `pair-agent/${input.hayloArticle.slug}`,
    skipReviewQueue: true,
    brand,
    hayloSeed: {
      title: composed.title,
      bodyHtml: input.hayloArticle.bodyHtml,
      topicSlug: input.hayloArticle.topicSlug ?? null,
    },
  });

  const qcScore = pipelineResult.draftSummary.qcScore;
  const verdict = verdictFromScore(qcScore);
  const issues = qcIssuesToAuditorIssues(pipelineResult.qcIssues);
  const summary = buildAuditSummary(verdict, qcScore, pipelineResult.qcNotes);

  const audit: AuditorResult = {
    verdict,
    flowScore: qcScore,
    issues,
    summary,
    costUsd: pipelineResult.totalCostUsd,
    totalTokens: pipelineResult.totalTokens,
  };

  const agentDraft = pipelineResult.draftPayload;
  const suggestedSlug = buildSuggestedSlug(input.city.slug, input.hayloArticle.slug);

  // The LLM reads the finished article body and writes Meta Title + Meta
  // Description. No formula fallback, no naturalizer tiers: if it can't pass
  // the gates after retries, metaSource is "needs-meta" and we ship NO meta
  // (the article is flagged for a human) rather than a deterministic glue
  // string. metaSource is recorded so the admin UI shows provenance.
  const meta = await generateArticleMeta({
    articleTitle: agentDraft.title ?? input.hayloArticle.title,
    articleBody: agentDraft.bodyHtml,
    cityName: input.city.cityName,
    brand: {
      personaDisplayName: brand.personaDisplayName,
      brandVertical: brand.brandVertical,
      brandTagline: brand.brandTagline,
    },
  });
  const metaOk = meta.status === "ok";
  if (!metaOk) {
    console.warn(
      `[pairAgentOrchestrator] meta needs-meta for ${input.city.slug} (${meta.rejectionReason}); shipping no meta, flagged for human.`,
    );
  }

  const draftPayload: NewsroomDraftPayloadV1 = {
    ...agentDraft,
    citySlug: input.city.slug,
    suggestedSlug,
    metaTitle: metaOk ? meta.title! : undefined,
    metaDescription: metaOk ? meta.description! : undefined,
    metaSource: metaOk ? "llm" : "needs-meta",
    dateline: agentDraft.dateline ?? composed.dateline,
    authorName: agentDraft.authorName ?? brand.authorName,
    publisherName: agentDraft.publisherName ?? brand.publisherName,
    hayloArticleId: input.hayloArticle.id,
    auditVerdict: verdict,
    auditFlowScore: qcScore,
    auditSummary: summary,
    auditIssues: issues,
  };

  return {
    citySlug: input.city.slug,
    hayloArticleId: input.hayloArticle.id,
    composed,
    audit,
    draftPayload,
    suggestedSlug,
  };
}

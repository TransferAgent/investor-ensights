import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import type { AuditorIssue, AuditorResult, AuditVerdict } from "./auditor";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";
import {
  buildMetaDescription,
  buildSuggestedSlug,
  processPair,
  type PairInput,
  type PairResult,
} from "./pairProcessor";
import { runPipeline } from "./pipelineWorker";
import { makeOpenAIGenerator } from "./openaiGenerator";
import { ensureCitySources } from "./cityResearchAutoSeeder";

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

/**
 * Convert SEO-QC issue strings into AuditorIssue objects so they round-trip
 * through the same review queue / draft payload schema.
 */
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

/**
 * Pair-flow entrypoint. Routes to the slim mock for dry-run, or to the full
 * 5-agent (Researcher → Analyst → Copywriter → SEO QC → Linker) pipeline
 * with the Haylo essay seeded in v4 polish-mode otherwise.
 *
 * Returns a `PairResult` shape so the existing enqueue-pairs route saving
 * logic (PASS → knowledge_articles, WARN → newsroom_review_queue, FAIL →
 * knowledge_generation_log) keeps working unchanged.
 */
export async function runPairAgentPipeline(input: RunPairAgentInput): Promise<PairResult> {
  if (input.dryRun) {
    return processPair(input);
  }

  const composeInput: ComposeInput = {
    hayloTitle: input.hayloArticle.title,
    hayloBodyHtml: input.hayloArticle.bodyHtml,
    cityName: input.city.cityName,
    stateCode: input.city.stateCode,
    stateName: input.city.stateName ?? null,
    localVibe: input.localVibe ?? null,
    vibeSourceUrl: input.vibeSourceUrl ?? null,
    topicSlug: input.hayloArticle.topicSlug,
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
    hayloSeed: {
      // Use composer's cleaned title (handles truncated-sentence Haylo titles),
      // not the raw DB title — otherwise the Copywriter sees garbage and tends
      // to echo it back as the final headline.
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
  const metaDescription =
    agentDraft.metaDescription && agentDraft.metaDescription.length >= 40
      ? agentDraft.metaDescription
      : buildMetaDescription(input.city.cityName, input.city.stateCode, input.hayloArticle.title);

  const draftPayload: NewsroomDraftPayloadV1 = {
    ...agentDraft,
    citySlug: input.city.slug,
    suggestedSlug,
    metaDescription,
    dateline: agentDraft.dateline ?? composed.dateline,
    authorName: agentDraft.authorName ?? "Tableicity Newsroom",
    publisherName: agentDraft.publisherName ?? "Tableicity",
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

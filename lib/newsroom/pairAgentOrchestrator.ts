import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import type { AuditorIssue, AuditorResult, AuditVerdict } from "./auditor";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";
import {
  buildMetaDescription,
  buildMetaTitle,
  buildSuggestedSlug,
  processPair,
  type PairInput,
  type PairResult,
} from "./pairProcessor";
import { runPipeline } from "./pipelineWorker";
import { makeOpenAIGenerator } from "./openaiGenerator";
import { ensureCitySources } from "./cityResearchAutoSeeder";
import {
  metaContainsBrandAndCity,
  resolveBrandContext,
} from "./brandContext";
import { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } from "@/lib/tenant/context";

/**
 * PASS / WARN / FAIL thresholds for the multi-agent Pair flow. These mirror
 * the audit verdict shape used by the legacy Glue+grade flow so the
 * enqueue-pairs route's saving logic continues to work unchanged.
 */
const PASS_THRESHOLD = 75;
const WARN_THRESHOLD = 50;

const META_DESCRIPTION_MIN = 40;

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

  // MT-4.12: tiered meta selection.
  //   Tier-1 (LLM): use the copywriter's metaTitle/metaDescription IF it
  //                 contains BOTH the brand persona display name AND the city
  //                 name (case-insensitive). This is the "natural placement"
  //                 path the Conductor specified.
  //   Tier-2 (deterministic): otherwise use the locked
  //                 "${brand} in ${city}, ${state}: …" prefix.
  // metaSource is recorded so the admin UI can show provenance per article.
  const llmMetaTitleOk = metaContainsBrandAndCity(
    agentDraft.metaTitle,
    brand,
    input.city.cityName,
  );
  const llmMetaDescOk =
    !!agentDraft.metaDescription &&
    agentDraft.metaDescription.length >= META_DESCRIPTION_MIN &&
    metaContainsBrandAndCity(agentDraft.metaDescription, brand, input.city.cityName);

  let metaTitle: string;
  let metaDescription: string;
  let metaSource: "llm" | "fallback";

  if (llmMetaTitleOk && llmMetaDescOk) {
    metaTitle = agentDraft.metaTitle!;
    metaDescription = agentDraft.metaDescription!;
    metaSource = "llm";
  } else {
    if (!llmMetaTitleOk) {
      console.warn(
        `[pairAgentOrchestrator] LLM metaTitle missing brand or city; falling back to Tier-2 prefix.`,
        { citySlug: input.city.slug, raw: agentDraft.metaTitle ?? null },
      );
    }
    if (!llmMetaDescOk) {
      console.warn(
        `[pairAgentOrchestrator] LLM metaDescription missing brand or city (or too short); falling back to Tier-2 prefix.`,
        { citySlug: input.city.slug, length: agentDraft.metaDescription?.length ?? 0 },
      );
    }
    metaTitle = buildMetaTitle(
      brand,
      input.city.cityName,
      input.city.stateCode,
      input.hayloArticle.title,
    );
    metaDescription = buildMetaDescription(
      brand,
      input.city.cityName,
      input.city.stateCode,
      input.hayloArticle.title,
      input.hayloArticle.bodyHtml,
    );
    metaSource = "fallback";
  }

  const draftPayload: NewsroomDraftPayloadV1 = {
    ...agentDraft,
    citySlug: input.city.slug,
    suggestedSlug,
    metaTitle,
    metaDescription,
    metaSource,
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

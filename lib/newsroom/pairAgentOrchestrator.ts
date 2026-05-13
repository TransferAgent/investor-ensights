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
  metaTitleAcceptable,
  metaDescriptionAcceptable,
  resolveBrandContext,
} from "./brandContext";
import { naturalizeMeta, hayloBodyExcerptFromHtml } from "./metaNaturalizer";
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

  // MT-4.13.4: tiered meta selection on the new contract.
  //   Tier-1 (LLM):       copywriter's meta passes the new title+desc gates
  //                       (city in title, brand BANNED from title; brand 1-2x
  //                       in desc but not in the first 40 chars).
  //   Tier-2.5 (LLM polish): Tier-1 reject → naturalizer rewrites the formula.
  //   Tier-2 (formula):   if naturalizer also fails its guards → safety net.
  //
  // metaSource is recorded so the admin UI can show provenance per article.
  const titleRejection = metaTitleAcceptable(
    agentDraft.metaTitle ?? null,
    brand,
    input.city.cityName,
  );
  const descRejection = metaDescriptionAcceptable(
    agentDraft.metaDescription ?? null,
    brand,
    input.city.cityName,
  );
  const llmMetaTitleOk = titleRejection === null;
  const llmMetaDescOk = descRejection === null;

  let metaTitle: string;
  let metaDescription: string;
  let metaSource: "llm" | "fallback" | "naturalized";

  if (llmMetaTitleOk && llmMetaDescOk) {
    metaTitle = agentDraft.metaTitle!;
    metaDescription = agentDraft.metaDescription!;
    metaSource = "llm";
  } else {
    if (!llmMetaTitleOk) {
      console.warn(
        `[pairAgentOrchestrator] LLM metaTitle rejected: ${titleRejection}; routing through Tier-2.5 naturalizer.`,
        { citySlug: input.city.slug, raw: agentDraft.metaTitle ?? null },
      );
    }
    if (!llmMetaDescOk) {
      console.warn(
        `[pairAgentOrchestrator] LLM metaDescription rejected: ${descRejection}; routing through Tier-2.5 naturalizer.`,
        { citySlug: input.city.slug, length: agentDraft.metaDescription?.length ?? 0 },
      );
    }
    // Tier-2: deterministic formula. Always computed so we have a guaranteed
    // safety-net string with the correct brand+city tokens.
    const fallbackTitle = buildMetaTitle(
      brand,
      input.city.cityName,
      input.city.stateCode,
      input.hayloArticle.title,
    );
    const fallbackDescription = buildMetaDescription(
      brand,
      input.city.cityName,
      input.city.stateCode,
      input.hayloArticle.title,
      input.hayloArticle.bodyHtml,
    );

    // MT-4.13.3 — Tier-2.5: in-line LLM "polish" pass over the formula. If
    // the naturalizer produces a string that contains brand+city, sits
    // inside the length bounds, and doesn't echo the formula's colon-prefix,
    // we ship the naturalized version. Otherwise we ship the formula
    // unchanged (silent degrade — naturalizer never throws).
    const polished = await naturalizeMeta({
      brand,
      cityName: input.city.cityName,
      stateCode: input.city.stateCode,
      hayloTitle: input.hayloArticle.title,
      hayloBodyExcerpt: hayloBodyExcerptFromHtml(input.hayloArticle.bodyHtml),
      fallbackTitle,
      fallbackDescription,
    });
    if (polished.source === "naturalized") {
      console.info(
        `[pairAgentOrchestrator] Tier-2.5 naturalizer applied (cost=$${polished.costUsd}, tokens=${polished.tokensUsed}).`,
        { citySlug: input.city.slug },
      );
    } else if (polished.rejectionReason) {
      console.warn(
        `[pairAgentOrchestrator] Tier-2.5 naturalizer rejected (${polished.rejectionReason}); shipping Tier-2 formula.`,
        { citySlug: input.city.slug },
      );
    }
    metaTitle = polished.title;
    metaDescription = polished.description;
    metaSource = polished.source === "naturalized" ? "naturalized" : "fallback";
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

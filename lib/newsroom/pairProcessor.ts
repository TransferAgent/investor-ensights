import { createHash } from "node:crypto";
import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import { auditPressRelease, type AuditorInput, type AuditorResult, type AuditorIssue } from "./auditor";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";
import { resolveBrandContext } from "./brandContext";
import { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } from "@/lib/tenant/context";
import { generateArticleMeta } from "./articleMetaGenerator";

export interface PairInput {
  hayloArticle: Pick<HayloArticle, "id" | "slug" | "title" | "topicSlug" | "bodyHtml">;
  city: Pick<CityLocation, "slug" | "cityName" | "stateCode" | "stateName">;
  localVibe?: string | null;
  vibeSourceUrl?: string | null;
  dryRun?: boolean;
}

export interface PairResult {
  citySlug: string;
  hayloArticleId: string;
  composed: ComposeResult;
  audit: AuditorResult;
  draftPayload: NewsroomDraftPayloadV1;
  suggestedSlug: string;
}

export function buildSuggestedSlug(citySlug: string, hayloSlug: string): string {
  // MT-4.5: persona slug = schema name = article slug prefix (locked decision in
  // replit.md). Use the current tenant context — Tableicity yields the original
  // "tableicity-..." prefix (backward compatible with all 80 published slugs);
  // any other tenant gets its own persona prefix. Falls back to DEFAULT_TENANT_SLUG
  // ("tableicity") outside a request, preserving prior CLI behaviour.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getCurrentTenantSlug, DEFAULT_TENANT_SLUG } = require("@/lib/tenant/context") as typeof import("@/lib/tenant/context");
  const personaSlug = getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG;
  const base = `${personaSlug}-${citySlug}-${hayloSlug}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 110);
}

function mockAudit(input: { citySlug: string; hayloArticleId: string; localVibeWasInjected: boolean; warnings: string[] }): AuditorResult {
  const seed = createHash("sha1").update(`${input.citySlug}|${input.hayloArticleId}`).digest()[0];
  const bucket = seed % 10;

  const issues: AuditorIssue[] = [];
  if (!input.localVibeWasInjected) {
    issues.push({
      severity: "low",
      category: "vibe-flow",
      message: "Local vibe was not injected (no v3 grounded vibe available for this city yet).",
    });
  }
  for (const w of input.warnings.slice(0, 2)) {
    issues.push({ severity: "low", category: "template-artifact", message: w });
  }

  const flowScore = 85 + (bucket % 3);
  return {
    verdict: "pass",
    flowScore,
    issues,
    summary: "Dry run: composition looks coherent. (Mock — set OPENAI_API_KEY and uncheck Dry Run for a real audit.)",
    costUsd: 0,
    totalTokens: 0,
  };
}

export async function processPair(input: PairInput): Promise<PairResult> {
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
  const composed = composePressRelease(composeInput);

  let audit: AuditorResult;
  if (input.dryRun) {
    audit = mockAudit({
      citySlug: input.city.slug,
      hayloArticleId: input.hayloArticle.id,
      localVibeWasInjected: composed.vibeInjected,
      warnings: composed.warnings,
    });
  } else {
    const auditorInput: AuditorInput = {
      cityName: input.city.cityName,
      stateCode: input.city.stateCode,
      localVibe: input.localVibe ?? null,
      fullHtml: composed.fullHtml,
    };
    audit = await auditPressRelease(auditorInput);
  }

  const suggestedSlug = buildSuggestedSlug(input.city.slug, input.hayloArticle.slug);
  const brand = await resolveBrandContext(
    getCurrentTenantSlug() ?? DEFAULT_TENANT_SLUG,
  );

  // Meta: the LLM reads the composed article and writes Title + Description.
  // No formula fallback — if it can't satisfy the gates after retries,
  // metaSource is "needs-meta" (the article is flagged for a human) and we
  // ship NO meta string rather than deterministic glue.
  const meta = await generateArticleMeta({
    articleTitle: composed.title,
    articleBody: composed.fullHtml,
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
      `[processPair] meta needs-meta for ${input.city.slug} (${meta.rejectionReason}); shipping no meta, flagged for human.`,
    );
  }

  const draftPayload: NewsroomDraftPayloadV1 = {
    version: "v1",
    citySlug: input.city.slug,
    suggestedSlug,
    title: composed.title,
    metaTitle: metaOk ? meta.title! : undefined,
    metaDescription: metaOk ? meta.description! : undefined,
    metaSource: metaOk ? "llm" : "needs-meta",
    headline: composed.title,
    dateline: composed.dateline,
    bodyHtml: composed.fullHtml,
    authorName: brand.authorName,
    publisherName: brand.publisherName,
    hayloArticleId: input.hayloArticle.id,
    auditVerdict: audit.verdict,
    auditFlowScore: audit.flowScore,
    auditSummary: audit.summary,
    auditIssues: audit.issues,
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

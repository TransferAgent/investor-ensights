import { createHash } from "node:crypto";
import { composePressRelease, type ComposeInput, type ComposeResult } from "./pressReleaseComposer";
import { auditPressRelease, type AuditorInput, type AuditorResult, type AuditVerdict, type AuditorIssue } from "./auditor";
import { normalizeHayloBody } from "./hayloBodyNormalizer";
import type { HayloArticle, CityLocation } from "@shared/schema";
import type { NewsroomDraftPayloadV1 } from "./draftPayload";

const META_DESCRIPTION_TARGET_CHARS = 300;
const META_DESCRIPTION_HARD_MAX = 300;

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
  const base = `tableicity-${citySlug}-${hayloSlug}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 110);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|div)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) return text ? [text] : [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

function hardTruncateToPeriod(sentence: string, maxChars: number): string {
  if (sentence.length <= maxChars) return sentence;
  const slice = sentence.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:—\-–]+$/, "") + ".";
}

function buildMetaDescriptionFromBody(bodyHtml: string, maxChars: number): string | null {
  const normalized = normalizeHayloBody(bodyHtml);
  const text = htmlToPlainText(normalized);
  if (!text) return null;

  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;

  let acc = "";
  for (const s of sentences) {
    const tentative = acc ? `${acc} ${s}` : s;
    if (tentative.length > maxChars) {
      if (!acc) {
        return hardTruncateToPeriod(s, maxChars);
      }
      return acc;
    }
    acc = tentative;
  }
  return acc || null;
}

export function buildMetaDescription(
  cityName: string,
  stateCode: string,
  hayloTitle: string,
  hayloBodyHtml?: string,
): string {
  if (hayloBodyHtml) {
    const fromBody = buildMetaDescriptionFromBody(hayloBodyHtml, META_DESCRIPTION_TARGET_CHARS);
    if (fromBody) return fromBody.slice(0, META_DESCRIPTION_HARD_MAX);
  }
  const sentence = `${hayloTitle} — Investor Ensights insights for founders in ${cityName}, ${stateCode}.`;
  if (sentence.length >= 40) return sentence.slice(0, META_DESCRIPTION_HARD_MAX);
  return `${sentence} Cap table, equity, and 409A guidance for the ${cityName} startup community.`.slice(
    0,
    META_DESCRIPTION_HARD_MAX,
  );
}

function mockAudit(input: { citySlug: string; hayloArticleId: string; localVibeWasInjected: boolean; warnings: string[] }): AuditorResult {
  const seed = createHash("sha1").update(`${input.citySlug}|${input.hayloArticleId}`).digest()[0];
  const bucket = seed % 10;

  let verdict: AuditVerdict;
  if (bucket < 5) verdict = "pass";
  else if (bucket < 9) verdict = "warn";
  else verdict = "fail";

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

  if (verdict === "warn") {
    issues.push({
      severity: "medium",
      category: "tone",
      message: "Mock auditor flagged this for human review (dry run heuristic).",
    });
  }
  if (verdict === "fail") {
    issues.push({
      severity: "high",
      category: "city-mismatch",
      message: "Mock auditor blocked publication (dry run heuristic — no real LLM call made).",
    });
  }

  const flowScore = verdict === "pass" ? 85 + (bucket % 3) : verdict === "warn" ? 65 + (bucket % 5) : 40 + (bucket % 10);
  const summary =
    verdict === "pass"
      ? "Dry run: composition looks coherent. (Mock — set OPENAI_API_KEY and uncheck Dry Run for a real audit.)"
      : verdict === "warn"
        ? "Dry run: needs human eyes before publishing. (Mock auditor.)"
        : "Dry run: blocked from publishing. (Mock auditor.)";

  return { verdict, flowScore, issues, summary };
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
    topicSlug: input.hayloArticle.topicSlug,
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
  const metaDescription = buildMetaDescription(
    input.city.cityName,
    input.city.stateCode,
    input.hayloArticle.title,
    input.hayloArticle.bodyHtml,
  );

  const draftPayload: NewsroomDraftPayloadV1 = {
    version: "v1",
    citySlug: input.city.slug,
    suggestedSlug,
    title: composed.title,
    metaDescription,
    headline: composed.title,
    dateline: composed.dateline,
    bodyHtml: composed.fullHtml,
    authorName: "Investor Ensights",
    publisherName: "Investor Ensights",
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

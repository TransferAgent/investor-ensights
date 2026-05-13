import type { NewsroomDraftPayloadV1 } from "@/lib/newsroom/draftPayload";
import type { BrandContext } from "@/lib/newsroom/brandContext";

export type StageRole =
  | "researcher"
  | "data_analyst"
  | "copywriter"
  | "seo_qc"
  | "internal_linker";

export interface StageContext {
  citySlug: string;
  cityName: string;
  stateCode: string;
  jobId: string;
  /**
   * Optional Haylo seed for polish-mode runs (Pair flow). When present, the
   * Copywriter agent shifts from "write from scratch" to "produce a city-
   * localized opening lede + headline/title; preserve the Haylo body".
   * pipelineWorker stitches `normalizeHayloBody(hayloSeed.bodyHtml)` after the
   * copywriter's lede before SEO QC sees the draft.
   */
  hayloSeed?: {
    title: string;
    bodyHtml: string;
    topicSlug?: string | null;
  };
  /**
   * MT-4.12: per-tenant brand voice. Threaded into prompt builders so titles,
   * meta, CTAs, and boilerplate render in the active persona's voice instead
   * of hardcoded "Tableicity" / "Investor Ensights" strings. Optional only so
   * the fixture generator and legacy callers compile; live runs always set it.
   */
  brand?: BrandContext;
}

export interface ResearcherOutput {
  facts: Array<{
    key: string;
    value: Record<string, unknown>;
    sourceHint?: string;
    confidence?: "high" | "medium" | "low";
  }>;
  summary?: string;
}

export interface AnalystOutput {
  tableicityScore: number;
  rationale: string;
  topAngles: string[];
}

export interface CopywriterOutput {
  title: string;
  /** MT-4.12: SEO `<title>` (SERP). Optional from older fixtures. */
  metaTitle?: string;
  metaDescription?: string;
  headline: string;
  subheadline?: string;
  dateline?: string;
  bodyHtml: string;
}

export interface QcOutput {
  qcScore: number;
  qcNotes: string;
  issues?: string[];
}

export interface LinkerOutput {
  links: Array<{
    targetSlug: string;
    anchorText: string;
    position: number;
  }>;
}

export interface PriorOutputs {
  researcher?: ResearcherOutput;
  data_analyst?: AnalystOutput;
  copywriter?: CopywriterOutput;
  seo_qc?: QcOutput;
  internal_linker?: LinkerOutput;
}

export interface StageRunResult {
  output: Record<string, unknown>;
  tokensUsed: number;
  costUsd: number;
  knowledge?: Array<{
    key: string;
    value: Record<string, unknown>;
    sourceUrl?: string | null;
    confidence?: number | null;
  }>;
}

export interface CandidateCity {
  slug: string;
  cityName: string;
}

export interface PipelineGenerator {
  mode: "fixture" | "live";
  modelLabel: string;
  researcher(ctx: StageContext): Promise<StageRunResult>;
  data_analyst(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult>;
  copywriter(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult>;
  seo_qc(ctx: StageContext, prior: PriorOutputs): Promise<StageRunResult>;
  internal_linker(
    ctx: StageContext,
    prior: PriorOutputs,
    candidates: CandidateCity[]
  ): Promise<StageRunResult>;
}

export function composeDraftFromOutputs(opts: {
  citySlug: string;
  prior: PriorOutputs;
  links: LinkerOutput["links"];
  brand?: BrandContext;
}): NewsroomDraftPayloadV1 {
  const { citySlug, prior, links, brand } = opts;
  const cw = prior.copywriter;
  if (!cw) throw new Error("composeDraftFromOutputs: copywriter output missing");

  const today = new Date().toISOString().slice(0, 10);
  const slugBase = slugify(cw.title || citySlug);
  const suggestedSlug = `${slugBase}-${today}`.slice(0, 120);

  // MT-4.12: brand-aware boilerplate / attribution. Falls back to neutral
  // strings when brand context is missing (legacy callers / fixture mode).
  const personaDisplay = brand?.personaDisplayName ?? "Investor Ensights";
  const tagline = brand?.brandTagline ?? "Local company formation and equity insights for investors.";
  const author = brand?.authorName ?? `${personaDisplay} Newsroom`;
  const publisher = brand?.publisherName ?? personaDisplay;

  return {
    version: "v1",
    citySlug,
    suggestedSlug,
    title: cw.title,
    metaTitle: cw.metaTitle,
    metaDescription: cw.metaDescription,
    headline: cw.headline,
    subheadline: cw.subheadline,
    dateline: cw.dateline,
    bodyHtml: cw.bodyHtml,
    boilerplateHtml: `<p>About ${personaDisplay} — ${tagline}</p>`,
    authorName: author,
    publisherName: publisher,
    internalLinks: links,
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "untitled";
}

import type { NewsroomDraftPayloadV1 } from "@/lib/newsroom/draftPayload";

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
}): NewsroomDraftPayloadV1 {
  const { citySlug, prior, links } = opts;
  const cw = prior.copywriter;
  if (!cw) throw new Error("composeDraftFromOutputs: copywriter output missing");

  const today = new Date().toISOString().slice(0, 10);
  const slugBase = slugify(cw.title || citySlug);
  const suggestedSlug = `${slugBase}-${today}`.slice(0, 120);

  return {
    version: "v1",
    citySlug,
    suggestedSlug,
    title: cw.title,
    metaDescription: cw.metaDescription,
    headline: cw.headline,
    subheadline: cw.subheadline,
    dateline: cw.dateline,
    bodyHtml: cw.bodyHtml,
    boilerplateHtml: `<p>About Tableicity: cap-table software built for founders outside the coastal hubs. Free for teams under 25; paid plans start at $29/mo. <a href="https://www.tableicity.com">tableicity.com</a></p>`,
    authorName: "Tableicity Newsroom",
    publisherName: "Tableicity",
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

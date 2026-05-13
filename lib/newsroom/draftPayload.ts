import { z } from "zod";

export const NEWSROOM_DRAFT_PAYLOAD_VERSION = "v1" as const;

export const internalLinkSuggestionSchema = z.object({
  targetSlug: z.string().min(1),
  anchorText: z.string().min(1).max(120),
  position: z.number().int().nonnegative().optional(),
});

export const newsroomDraftPayloadV1Schema = z.object({
  version: z.literal("v1"),
  citySlug: z.string().min(1),
  suggestedSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens only"),
  title: z.string().min(10).max(120),
  // MT-4.12: SEO `<title>` (SERP) — distinct from H1 `title`. Soft target 50-60,
  // hard cap 90.
  metaTitle: z.string().min(10).max(90).optional(),
  metaDescription: z.string().min(40).max(300).optional(),
  // MT-4.12: provenance for the meta fields above. 'llm' = produced by the
  // copywriter agent and validated to contain brand+city; 'fallback' =
  // deterministic Tier-2 prefix; 'manual' = reviewer-edited.
  metaSource: z.enum(["llm", "fallback", "manual"]).optional(),
  headline: z.string().min(10),
  subheadline: z.string().optional(),
  dateline: z.string().max(120).optional(),
  bodyHtml: z.string().min(200),
  boilerplateHtml: z.string().optional(),
  ogImageUrl: z.string().url().optional(),
  authorName: z.string().max(100).optional(),
  publisherName: z.string().max(100).optional(),
  internalLinks: z.array(internalLinkSuggestionSchema).max(20).optional(),
  hayloArticleId: z.string().uuid().optional(),
  auditVerdict: z.enum(["pass", "warn", "fail"]).optional(),
  auditFlowScore: z.number().int().min(0).max(100).optional(),
  auditSummary: z.string().optional(),
  auditIssues: z
    .array(
      z.object({
        severity: z.enum(["low", "medium", "high"]),
        category: z.string(),
        message: z.string(),
      })
    )
    .optional(),
});

export type NewsroomDraftPayloadV1 = z.infer<typeof newsroomDraftPayloadV1Schema>;
export type NewsroomInternalLinkSuggestionInput = z.infer<typeof internalLinkSuggestionSchema>;

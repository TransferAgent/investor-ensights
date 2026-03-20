import { z } from "zod";

export const KnowledgeDraftPayloadV1 = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(5).max(120),
  locale: z.literal("en-US"),
  seo: z.object({
    title: z.string().min(10).max(80),
    description: z.string().min(50).max(200),
    ogImageUrl: z.string().url().optional(),
  }),
  article: z.object({
    headline: z.string().min(10).max(140),
    subheadline: z.string().optional(),
    dateline: z.string().optional(),
    bodyHtml: z.string().min(600),
    boilerplateHtml: z.string().optional(),
  }),
  attribution: z.object({
    authorName: z.string().min(1),
    authorType: z.enum(["Organization", "Person"]),
    publisherName: z.literal("Tableicity"),
  }),
  conductor: z.object({
    manualDirective: z.string().optional(),
    sourceUrl: z.string().url().optional(),
  }),
});

export type KnowledgeDraftPayloadV1Type = z.infer<typeof KnowledgeDraftPayloadV1>;

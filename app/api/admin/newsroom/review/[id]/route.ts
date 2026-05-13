import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  newsroomReviewQueue,
  knowledgeArticles,
  newsroomInternalLinkSuggestions,
  hayloArticles,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { newsroomDraftPayloadV1Schema } from "@/lib/newsroom/draftPayload";
import { withTenantAsync } from "@/lib/tenant/context";
import { resolveBrandContext } from "@/lib/newsroom/brandContext";

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewerNotes: z.string().optional(),
});

const SAFE_DEFAULT_ROBOTS =
  "noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
// MT-4.12: BASE_URL is the iE platform host (used for canonical URLs across
// every tenant). Fallback is the iE production domain — never a per-tenant
// brand domain (those live in `tenants.brand_home_url`).
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.investorensights.com";

interface SessionShape {
  username: string;
  tenantSlug: string;
}

async function handlePatch(
  session: SessionShape,
  id: string,
  body: z.infer<typeof patchSchema>,
) {
  const [review] = await db
    .select()
    .from(newsroomReviewQueue)
    .where(eq(newsroomReviewQueue.id, id))
    .limit(1);

  if (!review) {
    return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  }

  if (review.status !== "pending") {
    return NextResponse.json(
      { error: `Review already ${review.status}; cannot change.` },
      { status: 409 }
    );
  }

  if (body.status === "rejected") {
    const [updated] = await db
      .update(newsroomReviewQueue)
      .set({
        status: "rejected",
        reviewerNotes: body.reviewerNotes ?? null,
        reviewedBy: session.username,
        reviewedAt: new Date(),
      })
      .where(eq(newsroomReviewQueue.id, id))
      .returning();
    await logAuditEvent({
      username: session.username,
      action: "update",
      entityType: "newsroom_review",
      entityId: id,
      details: { status: "rejected" },
    });
    return NextResponse.json({ review: updated, publishedArticle: null });
  }

  const parsed = newsroomDraftPayloadV1Schema.safeParse(review.draftPayload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Draft payload does not conform to NewsroomDraftPayloadV1 — cannot publish.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }
  const draft = parsed.data;

  if (draft.citySlug !== review.citySlug) {
    return NextResponse.json(
      {
        error: `Draft citySlug "${draft.citySlug}" does not match review citySlug "${review.citySlug}".`,
      },
      { status: 422 }
    );
  }

  // MT-4.12: brand resolved against the active tenant (set by withTenantAsync
  // wrapper below). Used to fill in author/publisher when the draft payload
  // omits them — never falls back to a hardcoded persona name.
  const brand = await resolveBrandContext(session.tenantSlug);

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: knowledgeArticles.id })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.slug, draft.suggestedSlug))
      .limit(1);
    if (existing.length > 0) {
      throw new Error(
        `Slug "${draft.suggestedSlug}" already exists in knowledge_articles. Reject and regenerate with a different slug.`
      );
    }

    const now = new Date();
    const [article] = await tx
      .insert(knowledgeArticles)
      .values({
        slug: draft.suggestedSlug,
        citySlug: draft.citySlug,
        hayloArticleId: draft.hayloArticleId ?? null,
        status: "pending",
        title: draft.title,
        // MT-4.12: persist SEO meta + provenance from the approved draft payload.
        // meta_locked_at stays null until publish (separate gate).
        metaTitle: draft.metaTitle ?? null,
        metaDescription: draft.metaDescription ?? null,
        metaSource: draft.metaSource ?? null,
        metaGeneratedAt: draft.metaTitle || draft.metaDescription ? now : null,
        headline: draft.headline,
        subheadline: draft.subheadline ?? null,
        dateline: null,
        bodyHtml: draft.bodyHtml,
        boilerplateHtml: draft.boilerplateHtml ?? null,
        ogImageUrl: draft.ogImageUrl ?? null,
        robots: SAFE_DEFAULT_ROBOTS,
        canonicalUrl: `${BASE_URL}/discovery/knowledge/${draft.suggestedSlug}`,
        authorName: draft.authorName ?? brand.authorName,
        publisherName: draft.publisherName ?? brand.publisherName,
        datePublished: null,
        dateModified: now,
      })
      .returning();

    if (draft.hayloArticleId) {
      await tx
        .update(hayloArticles)
        .set({ placementCount: sql`${hayloArticles.placementCount} + 1`, updatedAt: now })
        .where(eq(hayloArticles.id, draft.hayloArticleId));
    }

    const [updatedReview] = await tx
      .update(newsroomReviewQueue)
      .set({
        status: "approved",
        reviewerNotes: body.reviewerNotes ?? null,
        reviewedBy: session.username,
        reviewedAt: now,
        publishedArticleId: article.id,
      })
      .where(and(eq(newsroomReviewQueue.id, id), eq(newsroomReviewQueue.status, "pending")))
      .returning();
    if (!updatedReview) {
      throw new Error("Review item is no longer pending — another reviewer beat you to it. Transaction rolled back.");
    }

    if (draft.internalLinks && draft.internalLinks.length > 0) {
      const existingLinks = await tx
        .select({ id: newsroomInternalLinkSuggestions.id })
        .from(newsroomInternalLinkSuggestions)
        .where(eq(newsroomInternalLinkSuggestions.reviewQueueId, id));
      if (existingLinks.length === 0) {
        await tx.insert(newsroomInternalLinkSuggestions).values(
          draft.internalLinks.map((link) => ({
            reviewQueueId: id,
            articleId: article.id,
            targetSlug: link.targetSlug,
            anchorText: link.anchorText,
            position: link.position ?? null,
            accepted: false,
          }))
        );
      } else {
        await tx
          .update(newsroomInternalLinkSuggestions)
          .set({ articleId: article.id })
          .where(eq(newsroomInternalLinkSuggestions.reviewQueueId, id));
      }
    }

      return { review: updatedReview, article };
    });
  } catch (e: any) {
    const msg = e?.message || "publish failed";
    if (msg.includes("already exists in knowledge_articles") || msg.includes("no longer pending")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("duplicate key") && msg.includes("slug")) {
      return NextResponse.json({ error: `Slug "${draft.suggestedSlug}" already exists (race). Reject and regenerate.` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await logAuditEvent({
    username: session.username,
    action: "create",
    entityType: "knowledge_article",
    entityId: result.article.id,
    details: {
      source: "newsroom_review_publish",
      reviewId: id,
      slug: result.article.slug,
      robots: SAFE_DEFAULT_ROBOTS,
    },
  });

  return NextResponse.json({
    review: result.review,
    publishedArticle: result.article,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  // MT-4.12: bind every DB call in the publish flow to the reviewer's tenant
  // schema. Without this wrapper, db.* would land on the platform default
  // tenant — a multi-tenant data-bleed bug.
  return withTenantAsync(session.tenantSlug, () =>
    handlePatch(session as SessionShape, id, body),
  );
}

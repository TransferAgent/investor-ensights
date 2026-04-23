import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeArticleVersions } from "@shared/schema";
import { eq, inArray, and, sql, max } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const NOINDEX_ROBOTS = "noindex, follow";
const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

function normalizeSlug(s: string): string {
  let v = s.trim().toLowerCase();
  // strip protocol+host if user pasted full URL
  v = v.replace(/^https?:\/\/[^/]+/, "");
  // strip /discovery/knowledge/ prefix
  v = v.replace(/^\/+(discovery\/knowledge\/)?/, "");
  v = v.replace(/\/+$/, "");
  // remove query/hash
  v = v.split("?")[0].split("#")[0];
  return v;
}

const schema = z.object({
  indexedSlugs: z.array(z.string()).default([]),
  confirm: z.literal(true),
  allowMissing: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = schema.parse(await req.json());
  const safeList = new Set(body.indexedSlugs.map(normalizeSlug).filter(Boolean));

  // Re-check inside a transaction; only flip rows still matching the criteria
  const result = await db.transaction(async (tx) => {
    const articles = await tx
      .select({ id: knowledgeArticles.id, slug: knowledgeArticles.slug, robots: knowledgeArticles.robots })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.status, "published"));

    const safeListMissing: string[] = [];
    const presentSlugs = new Set(articles.map((a) => a.slug));
    for (const s of safeList) if (!presentSlugs.has(s)) safeListMissing.push(s);

    if (safeListMissing.length > 0 && !body.allowMissing) {
      return { aborted: true, safeListMissing, flipped: 0, total: articles.length };
    }

    const targets = articles.filter(
      (a) => !safeList.has(a.slug) && !(a.robots || "").toLowerCase().includes("noindex")
    );

    let flipped = 0;
    for (const a of targets) {
      // Compute next sequential version number per article
      const [{ maxV }] = await tx
        .select({ maxV: max(knowledgeArticleVersions.versionNumber) })
        .from(knowledgeArticleVersions)
        .where(eq(knowledgeArticleVersions.articleId, a.id));
      const nextVersion = (maxV ?? 0) + 1;

      await tx.insert(knowledgeArticleVersions).values({
        articleId: a.id,
        versionNumber: nextVersion,
        snapshotJson: { robots: a.robots, slug: a.slug, action: "pre-noindex-flip" } as any,
        snapshotReason: "seo-visibility-bulk-noindex",
        createdBy: session.username,
      });

      // Conditional update: only flip if still published and not already noindex.
      const updated = await tx
        .update(knowledgeArticles)
        .set({ robots: NOINDEX_ROBOTS, updatedAt: new Date() })
        .where(
          and(
            eq(knowledgeArticles.id, a.id),
            eq(knowledgeArticles.status, "published"),
            sql`lower(${knowledgeArticles.robots}) NOT LIKE '%noindex%'`
          )
        )
        .returning({ id: knowledgeArticles.id });
      if (updated.length > 0) flipped++;
    }

    return { aborted: false, flipped, total: articles.length, safeListMissing: [] as string[] };
  });

  if (result.aborted) {
    return NextResponse.json(
      { ok: false, aborted: true, reason: "safe_list_missing", safeListMissing: result.safeListMissing },
      { status: 409 }
    );
  }

  await logAuditEvent({
    username: session.username,
    action: "bulk_seo_visibility_apply",
    entityType: "knowledge_article",
    details: { flipped: result.flipped, safeListSize: safeList.size, total: result.total },
  });

  return NextResponse.json({ ok: true, flipped: result.flipped, safeListSize: safeList.size });
}

const restoreSchema = z.object({
  slugs: z.array(z.string()).min(1),
});

export async function PATCH(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = restoreSchema.parse(await req.json());
  const slugs = body.slugs.map(normalizeSlug).filter(Boolean);
  if (!slugs.length) return NextResponse.json({ error: "no valid slugs" }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const articles = await tx
      .select({ id: knowledgeArticles.id, slug: knowledgeArticles.slug, robots: knowledgeArticles.robots })
      .from(knowledgeArticles)
      .where(inArray(knowledgeArticles.slug, slugs));

    for (const a of articles) {
      const [{ maxV }] = await tx
        .select({ maxV: max(knowledgeArticleVersions.versionNumber) })
        .from(knowledgeArticleVersions)
        .where(eq(knowledgeArticleVersions.articleId, a.id));
      const nextVersion = (maxV ?? 0) + 1;
      await tx.insert(knowledgeArticleVersions).values({
        articleId: a.id,
        versionNumber: nextVersion,
        snapshotJson: { robots: a.robots, slug: a.slug, action: "pre-restore-indexable" } as any,
        snapshotReason: "seo-visibility-restore",
        createdBy: session.username,
      });
    }

    const updated = await tx
      .update(knowledgeArticles)
      .set({ robots: DEFAULT_ROBOTS, updatedAt: new Date() })
      .where(inArray(knowledgeArticles.slug, slugs))
      .returning({ id: knowledgeArticles.id, slug: knowledgeArticles.slug });

    return updated;
  });

  await logAuditEvent({
    username: session.username,
    action: "seo_visibility_restore",
    entityType: "knowledge_article",
    details: { restored: result.length, slugs },
  });

  return NextResponse.json({ ok: true, restored: result.length, slugs: result.map((r) => r.slug) });
}

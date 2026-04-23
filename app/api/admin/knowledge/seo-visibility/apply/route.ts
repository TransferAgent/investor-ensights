import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeArticleVersions, cityLocations } from "@shared/schema";
import { eq, inArray, and, sql, max } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { parseSafeEntry } from "../preview/route";

const NOINDEX_ROBOTS = "noindex, follow";
const DEFAULT_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

const schema = z.object({
  indexedUrls: z.array(z.string()).default([]),
  confirm: z.literal(true),
  allowMissing: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = schema.parse(await req.json());

  const parsed = body.indexedUrls.map(parseSafeEntry);
  const articleSafeList = new Set(parsed.filter((p) => p.kind === "article").map((p: any) => p.slug));
  const citySafeList = new Set(parsed.filter((p) => p.kind === "city").map((p: any) => p.slug));

  const result = await db.transaction(async (tx) => {
    const articles = await tx
      .select({ id: knowledgeArticles.id, slug: knowledgeArticles.slug, robots: knowledgeArticles.robots })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.status, "published"));
    const cities = await tx
      .select({ id: cityLocations.id, slug: cityLocations.slug, allowIndexing: cityLocations.allowIndexing })
      .from(cityLocations)
      .where(eq(cityLocations.isPublished, true));

    const presentArticleSlugs = new Set(articles.map((a) => a.slug));
    const presentCitySlugs = new Set(cities.map((c) => c.slug));
    const missingArticles = Array.from(articleSafeList).filter((s) => !presentArticleSlugs.has(s));
    const missingCities = Array.from(citySafeList).filter((s) => !presentCitySlugs.has(s));

    if ((missingArticles.length > 0 || missingCities.length > 0) && !body.allowMissing) {
      return {
        aborted: true,
        articleSafeListMissing: missingArticles,
        citySafeListMissing: missingCities,
        articlesFlipped: 0,
        citiesFlipped: 0,
      };
    }

    // Articles: flip non-safe-listed published indexable to noindex (snapshot first)
    const articleTargets = articles.filter(
      (a) => !articleSafeList.has(a.slug) && !(a.robots || "").toLowerCase().includes("noindex")
    );
    let articlesFlipped = 0;
    for (const a of articleTargets) {
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
      if (updated.length > 0) articlesFlipped++;
    }

    // Cities: flip allowIndexing -> false for non-safe-listed published indexable cities
    const cityTargets = cities.filter((c) => !citySafeList.has(c.slug) && c.allowIndexing !== false);
    let citiesFlipped = 0;
    if (cityTargets.length > 0) {
      const ids = cityTargets.map((c) => c.id);
      const updated = await tx
        .update(cityLocations)
        .set({ allowIndexing: false, updatedAt: new Date() })
        .where(and(inArray(cityLocations.id, ids), eq(cityLocations.allowIndexing, true)))
        .returning({ id: cityLocations.id });
      citiesFlipped = updated.length;
    }

    return {
      aborted: false,
      articlesFlipped,
      citiesFlipped,
      articleSafeListMissing: [] as string[],
      citySafeListMissing: [] as string[],
    };
  });

  if (result.aborted) {
    return NextResponse.json(
      {
        ok: false,
        aborted: true,
        reason: "safe_list_missing",
        articleSafeListMissing: result.articleSafeListMissing,
        citySafeListMissing: result.citySafeListMissing,
      },
      { status: 409 }
    );
  }

  await logAuditEvent({
    username: session.username,
    action: "bulk_seo_visibility_apply",
    entityType: "mixed",
    details: {
      articlesFlipped: result.articlesFlipped,
      citiesFlipped: result.citiesFlipped,
      articleSafeListSize: articleSafeList.size,
      citySafeListSize: citySafeList.size,
    },
  });

  return NextResponse.json({
    ok: true,
    articlesFlipped: result.articlesFlipped,
    citiesFlipped: result.citiesFlipped,
  });
}

const restoreSchema = z.object({
  urls: z.array(z.string()).min(1),
});

export async function PATCH(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = restoreSchema.parse(await req.json());
  const parsed = body.urls.map(parseSafeEntry);
  const articleSlugs = parsed.filter((p) => p.kind === "article").map((p: any) => p.slug);
  const citySlugs = parsed.filter((p) => p.kind === "city").map((p: any) => p.slug);
  if (!articleSlugs.length && !citySlugs.length) {
    return NextResponse.json({ error: "no valid slugs/urls" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    let articlesRestored: { id: string; slug: string }[] = [];
    if (articleSlugs.length) {
      const articles = await tx
        .select({ id: knowledgeArticles.id, slug: knowledgeArticles.slug, robots: knowledgeArticles.robots })
        .from(knowledgeArticles)
        .where(inArray(knowledgeArticles.slug, articleSlugs));
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
      articlesRestored = await tx
        .update(knowledgeArticles)
        .set({ robots: DEFAULT_ROBOTS, updatedAt: new Date() })
        .where(inArray(knowledgeArticles.slug, articleSlugs))
        .returning({ id: knowledgeArticles.id, slug: knowledgeArticles.slug });
    }

    let citiesRestored: { id: string; slug: string }[] = [];
    if (citySlugs.length) {
      citiesRestored = await tx
        .update(cityLocations)
        .set({ allowIndexing: true, updatedAt: new Date() })
        .where(inArray(cityLocations.slug, citySlugs))
        .returning({ id: cityLocations.id, slug: cityLocations.slug });
    }
    return { articlesRestored, citiesRestored };
  });

  await logAuditEvent({
    username: session.username,
    action: "seo_visibility_restore",
    entityType: "mixed",
    details: {
      articlesRestored: result.articlesRestored.length,
      citiesRestored: result.citiesRestored.length,
      articleSlugs,
      citySlugs,
    },
  });

  return NextResponse.json({
    ok: true,
    articlesRestored: result.articlesRestored.length,
    citiesRestored: result.citiesRestored.length,
    restoredSlugs: {
      articles: result.articlesRestored.map((a) => a.slug),
      cities: result.citiesRestored.map((c) => c.slug),
    },
  });
}

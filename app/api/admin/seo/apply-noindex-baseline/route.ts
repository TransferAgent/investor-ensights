import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cityLocations, knowledgeArticles } from "@shared/schema";
import { and, eq, notInArray, or, isNull, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  PROTECTED_CITY_SLUGS,
  PROTECTED_ARTICLE_SLUGS,
  NOINDEX_ROBOTS,
} from "@/config/protectedSlugs";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cityRows = await db.select({ slug: cityLocations.slug, allowIndexing: cityLocations.allowIndexing }).from(cityLocations);
  const articleRows = await db.select({ slug: knowledgeArticles.slug, robots: knowledgeArticles.robots }).from(knowledgeArticles);

  const protectedCitySet = new Set<string>(PROTECTED_CITY_SLUGS);
  const protectedArticleSet = new Set<string>(PROTECTED_ARTICLE_SLUGS);

  const citiesToFlip = cityRows.filter((c) => !protectedCitySet.has(c.slug) && c.allowIndexing === true).length;
  const articlesToFlip = articleRows.filter(
    (a) => !protectedArticleSet.has(a.slug) && (!a.robots || !a.robots.includes("noindex"))
  ).length;

  const missingCities = [...protectedCitySet].filter((s) => !cityRows.find((c) => c.slug === s));
  const missingArticles = [...protectedArticleSet].filter((s) => !articleRows.find((a) => a.slug === s));

  return NextResponse.json({
    preview: true,
    totals: {
      cities: cityRows.length,
      articles: articleRows.length,
      protectedCitiesConfigured: PROTECTED_CITY_SLUGS.length,
      protectedArticlesConfigured: PROTECTED_ARTICLE_SLUGS.length,
    },
    willFlipToNoindex: { cities: citiesToFlip, articles: articlesToFlip },
    missingFromDatabase: { cities: missingCities, articles: missingArticles },
  });
}

export async function POST() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const protectedCities = [...PROTECTED_CITY_SLUGS];
  const protectedArticles = [...PROTECTED_ARTICLE_SLUGS];

  const flippedCities = await db
    .update(cityLocations)
    .set({ allowIndexing: false })
    .where(
      and(
        eq(cityLocations.allowIndexing, true),
        notInArray(cityLocations.slug, protectedCities)
      )
    )
    .returning({ slug: cityLocations.slug });

  const flippedArticles = await db
    .update(knowledgeArticles)
    .set({ robots: NOINDEX_ROBOTS })
    .where(
      and(
        notInArray(knowledgeArticles.slug, protectedArticles),
        or(isNull(knowledgeArticles.robots), sql`${knowledgeArticles.robots} NOT LIKE '%noindex%'`)
      )
    )
    .returning({ slug: knowledgeArticles.slug });

  await logAuditEvent({
    username: session.username,
    action: "apply_noindex_baseline",
    entityType: "seo",
    entityId: "baseline",
    details: {
      flippedCities: flippedCities.length,
      flippedArticles: flippedArticles.length,
      protectedCitiesConfigured: protectedCities.length,
      protectedArticlesConfigured: protectedArticles.length,
    },
  });

  return NextResponse.json({
    ok: true,
    flipped: {
      cities: flippedCities.length,
      articles: flippedArticles.length,
    },
    sample: {
      cities: flippedCities.slice(0, 5).map((r) => r.slug),
      articles: flippedArticles.slice(0, 5).map((r) => r.slug),
    },
  });
}

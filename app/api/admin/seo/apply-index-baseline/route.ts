import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cityLocations, knowledgeArticles } from "@shared/schema";
import { and, inArray, eq, or, isNull, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  PROTECTED_CITY_SLUGS,
  PROTECTED_ARTICLE_SLUGS,
  INDEX_ROBOTS,
} from "@/config/protectedSlugs";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const protectedCities = [...PROTECTED_CITY_SLUGS];
  const protectedArticles = [...PROTECTED_ARTICLE_SLUGS];

  const cityRows = await db
    .select({ slug: cityLocations.slug, allowIndexing: cityLocations.allowIndexing })
    .from(cityLocations)
    .where(inArray(cityLocations.slug, protectedCities));

  const articleRows = await db
    .select({ slug: knowledgeArticles.slug, robots: knowledgeArticles.robots })
    .from(knowledgeArticles)
    .where(inArray(knowledgeArticles.slug, protectedArticles));

  const citiesToFlip = cityRows.filter((c) => c.allowIndexing === false).length;
  const articlesToFlip = articleRows.filter(
    (a) => a.robots && a.robots.includes("noindex")
  ).length;

  const presentCitySlugs = new Set(cityRows.map((r) => r.slug));
  const presentArticleSlugs = new Set(articleRows.map((r) => r.slug));
  const missingCities = protectedCities.filter((s) => !presentCitySlugs.has(s));
  const missingArticles = protectedArticles.filter((s) => !presentArticleSlugs.has(s));

  return NextResponse.json({
    preview: true,
    totals: {
      protectedCitiesConfigured: protectedCities.length,
      protectedArticlesConfigured: protectedArticles.length,
      protectedCitiesInDb: cityRows.length,
      protectedArticlesInDb: articleRows.length,
    },
    willFlipToIndex: { cities: citiesToFlip, articles: articlesToFlip },
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
    .set({ allowIndexing: true })
    .where(
      and(
        inArray(cityLocations.slug, protectedCities),
        eq(cityLocations.allowIndexing, false)
      )
    )
    .returning({ slug: cityLocations.slug });

  const flippedArticles = await db
    .update(knowledgeArticles)
    .set({ robots: INDEX_ROBOTS })
    .where(
      and(
        inArray(knowledgeArticles.slug, protectedArticles),
        or(
          isNull(knowledgeArticles.robots),
          sql`${knowledgeArticles.robots} LIKE '%noindex%'`
        )
      )
    )
    .returning({ slug: knowledgeArticles.slug });

  await logAuditEvent({
    username: session.username,
    action: "apply_index_baseline",
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

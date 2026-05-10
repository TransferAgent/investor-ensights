import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles } from "@shared/schema";
import { sql, eq, gte, and } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  return withAdminAuth(async (session) => {

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [publishedThisMonthResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(and(
      eq(knowledgeArticles.status, "published"),
      gte(knowledgeArticles.datePublished, startOfMonth)
    ));

  const [discoverEligibleResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(and(
      eq(knowledgeArticles.status, "published"),
      gte(knowledgeArticles.imageWidth, 1200)
    ));

  const [pendingResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.status, "pending"));

  const publishedArticles = await db.select({ datePublished: knowledgeArticles.datePublished })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.status, "published"));

  let avgFreshnessScore = 0;
  if (publishedArticles.length > 0) {
    const nowMs = Date.now();
    const scores = publishedArticles.map(a => {
      if (!a.datePublished) return 0;
      const hoursAgo = (nowMs - new Date(a.datePublished).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) return 3;
      if (hoursAgo < 24 * 7) return 2;
      return 1;
    });
    avgFreshnessScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  return NextResponse.json({
    publishedThisMonth: Number(publishedThisMonthResult.count),
    discoverEligible: Number(discoverEligibleResult.count),
    avgFreshnessScore,
    pendingCount: Number(pendingResult.count),
  });
  });
}

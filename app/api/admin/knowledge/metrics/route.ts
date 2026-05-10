import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles } from "@shared/schema";
import { sql, eq, gte, and } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  return withAdminAuth(async (session) => {

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [todayResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(and(
      eq(knowledgeArticles.status, "published"),
      gte(knowledgeArticles.datePublished, startOfToday)
    ));

  const [weekResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(and(
      eq(knowledgeArticles.status, "published"),
      gte(knowledgeArticles.datePublished, sevenDaysAgo)
    ));

  const [pendingResult] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.status, "pending"));

  const today = Number(todayResult.count);
  const thisWeek = Number(weekResult.count);
  const pendingCount = Number(pendingResult.count);
  const avgPerDay = Math.round((thisWeek / 7) * 10) / 10;

  return NextResponse.json({ today, thisWeek, avgPerDay, pendingCount });
  });
}

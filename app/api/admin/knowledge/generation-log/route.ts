import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeGenerationLog } from "@shared/schema";
import { desc, gte, eq, sql } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
  return withAdminAuth(async (session) => {

  const { searchParams } = new URL(req.url);
  const parsed = parseInt(searchParams.get("limit") || "50");
  const limitParam = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 50;

  const logs = await db.select()
    .from(knowledgeGenerationLog)
    .orderBy(desc(knowledgeGenerationLog.createdAt))
    .limit(limitParam);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [todayCount] = await db.select({ count: sql<number>`count(*)` })
    .from(knowledgeGenerationLog)
    .where(gte(knowledgeGenerationLog.createdAt, startOfToday));

  return NextResponse.json({
    logs,
    callsToday: Number(todayCount.count),
  });
  });
}

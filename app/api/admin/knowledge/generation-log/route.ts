import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeGenerationLog } from "@shared/schema";
import { desc, gte, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
}

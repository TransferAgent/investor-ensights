import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, desc, gte, and } from "drizzle-orm";
import { newsroomSchedulerRuns } from "@shared/schema";
import { verifySession } from "@/lib/auth";
import { countEligiblePairs } from "@/lib/newsroom/schedulerPicker";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  const runs = await db
    .select()
    .from(newsroomSchedulerRuns)
    .orderBy(desc(newsroomSchedulerRuns.tickAt))
    .limit(limit);

  const sinceUtcMidnight = new Date();
  sinceUtcMidnight.setUTCHours(0, 0, 0, 0);

  const [today] = await db
    .select({
      pairings: sql<string>`COUNT(*) FILTER (WHERE outcome LIKE 'paired_%')::text`,
      passes: sql<string>`COUNT(*) FILTER (WHERE outcome = 'paired_pass')::text`,
      warns: sql<string>`COUNT(*) FILTER (WHERE outcome = 'paired_warn')::text`,
      fails: sql<string>`COUNT(*) FILTER (WHERE outcome = 'paired_fail')::text`,
      errors: sql<string>`COUNT(*) FILTER (WHERE outcome = 'error')::text`,
      costUsd: sql<string>`COALESCE(SUM(cost_usd), 0)::text`,
      tokens: sql<string>`COALESCE(SUM(total_tokens), 0)::text`,
    })
    .from(newsroomSchedulerRuns)
    .where(gte(newsroomSchedulerRuns.tickAt, sinceUtcMidnight));

  const eligiblePairs = await countEligiblePairs();

  return NextResponse.json({
    runs,
    today: {
      pairings: Number(today?.pairings ?? "0"),
      passes: Number(today?.passes ?? "0"),
      warns: Number(today?.warns ?? "0"),
      fails: Number(today?.fails ?? "0"),
      errors: Number(today?.errors ?? "0"),
      costUsd: Number(today?.costUsd ?? "0"),
      tokens: Number(today?.tokens ?? "0"),
    },
    eligiblePairs,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [totals] = (await db.execute(sql`
    SELECT
      COALESCE(SUM(tokens_used), 0)::bigint AS total_tokens,
      COALESCE(SUM(cost_usd), 0)::numeric AS total_cost_usd,
      COUNT(*)::int AS total_runs,
      COUNT(*) FILTER (WHERE dry_run = true)::int AS dry_runs,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS runs_24h,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0)::numeric AS cost_24h,
      COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::numeric AS cost_7d
    FROM newsroom_agent_runs
  `)).rows as any;

  const byJob = (await db.execute(sql`
    SELECT
      job_id,
      COUNT(*)::int AS runs,
      COALESCE(SUM(tokens_used), 0)::bigint AS tokens,
      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
    FROM newsroom_agent_runs
    WHERE job_id IS NOT NULL
    GROUP BY job_id
    ORDER BY MAX(created_at) DESC
    LIMIT 50
  `)).rows;

  const byAgent = (await db.execute(sql`
    SELECT
      agent_id,
      COUNT(*)::int AS runs,
      COALESCE(SUM(tokens_used), 0)::bigint AS tokens,
      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd
    FROM newsroom_agent_runs
    GROUP BY agent_id
  `)).rows;

  return NextResponse.json({ totals, byJob, byAgent });
}

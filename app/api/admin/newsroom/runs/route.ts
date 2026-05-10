import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgentRuns } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { withTenantAsync } from "@/lib/tenant/context";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const jobId = url.searchParams.get("jobId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

  const conditions = [];
  if (agentId) conditions.push(eq(newsroomAgentRuns.agentId, agentId));
  if (jobId) conditions.push(eq(newsroomAgentRuns.jobId, jobId));

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(newsroomAgentRuns)
          .where(and(...conditions))
          .orderBy(desc(newsroomAgentRuns.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(newsroomAgentRuns)
          .orderBy(desc(newsroomAgentRuns.createdAt))
          .limit(limit);
  return NextResponse.json(rows);
  });
}

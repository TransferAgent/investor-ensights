import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgentKnowledge } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { withTenantAsync } from "@/lib/tenant/context";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const citySlug = url.searchParams.get("citySlug");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  const conditions = [];
  if (agentId) conditions.push(eq(newsroomAgentKnowledge.agentId, agentId));
  if (citySlug) conditions.push(eq(newsroomAgentKnowledge.citySlug, citySlug));

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(newsroomAgentKnowledge)
          .where(and(...conditions))
          .orderBy(desc(newsroomAgentKnowledge.fetchedAt))
          .limit(limit)
      : await db
          .select()
          .from(newsroomAgentKnowledge)
          .orderBy(desc(newsroomAgentKnowledge.fetchedAt))
          .limit(limit);
  return NextResponse.json(rows);
  });
}

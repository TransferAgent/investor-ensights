import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgentKnowledge } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET(req: Request) {
  return withAdminAuth(async (session) => {
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

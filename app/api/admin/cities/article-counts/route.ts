import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeArticles } from "@shared/schema";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET() {
  return withAdminAuth(async (session) => {

  const rows = await db
    .select({
      citySlug: knowledgeArticles.citySlug,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgeArticles)
    .where(sql`${knowledgeArticles.status} = 'published' and ${knowledgeArticles.citySlug} is not null`)
    .groupBy(knowledgeArticles.citySlug);

  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (r.citySlug) counts[r.citySlug] = Number(r.count) || 0;
  }
  return NextResponse.json(counts);
  });
}

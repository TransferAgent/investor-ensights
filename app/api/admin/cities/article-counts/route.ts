import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeArticles } from "@shared/schema";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}

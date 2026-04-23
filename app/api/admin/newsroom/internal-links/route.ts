import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomInternalLinkSuggestions } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const reviewQueueId = url.searchParams.get("reviewQueueId");
  const articleId = url.searchParams.get("articleId");

  let rows;
  if (reviewQueueId) {
    rows = await db
      .select()
      .from(newsroomInternalLinkSuggestions)
      .where(eq(newsroomInternalLinkSuggestions.reviewQueueId, reviewQueueId))
      .orderBy(desc(newsroomInternalLinkSuggestions.createdAt));
  } else if (articleId) {
    rows = await db
      .select()
      .from(newsroomInternalLinkSuggestions)
      .where(eq(newsroomInternalLinkSuggestions.articleId, articleId))
      .orderBy(desc(newsroomInternalLinkSuggestions.createdAt));
  } else {
    rows = await db
      .select()
      .from(newsroomInternalLinkSuggestions)
      .orderBy(desc(newsroomInternalLinkSuggestions.createdAt))
      .limit(200);
  }

  return NextResponse.json(rows);
}

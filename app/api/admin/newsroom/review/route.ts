import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomReviewQueue } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function GET(req: Request) {
  return withAdminAuth(async (session) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  const rows = await db
    .select()
    .from(newsroomReviewQueue)
    .where(eq(newsroomReviewQueue.status, status))
    .orderBy(desc(newsroomReviewQueue.createdAt))
    .limit(100);
  return NextResponse.json(rows);
  });
}

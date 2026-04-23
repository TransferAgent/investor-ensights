import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomInternalLinkSuggestions, newsroomReviewQueue } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";
import { z } from "zod";

const schema = z.object({
  reviewQueueId: z.string().uuid(),
  suggestions: z
    .array(
      z.object({
        targetSlug: z.string().min(1),
        anchorText: z.string().min(1).max(120),
        position: z.number().int().nonnegative().optional(),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = schema.parse(await req.json());

  const [review] = await db
    .select({ id: newsroomReviewQueue.id })
    .from(newsroomReviewQueue)
    .where(eq(newsroomReviewQueue.id, body.reviewQueueId))
    .limit(1);
  if (!review) {
    return NextResponse.json({ error: "review item not found" }, { status: 404 });
  }

  const inserted = await db
    .insert(newsroomInternalLinkSuggestions)
    .values(
      body.suggestions.map((s) => ({
        reviewQueueId: body.reviewQueueId,
        targetSlug: s.targetSlug,
        anchorText: s.anchorText,
        position: s.position ?? null,
        accepted: false,
      }))
    )
    .returning();

  return NextResponse.json({ inserted: inserted.length });
}

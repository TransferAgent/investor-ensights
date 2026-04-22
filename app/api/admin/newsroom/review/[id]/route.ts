import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomReviewQueue } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewerNotes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = patchSchema.parse(await req.json());
  const [updated] = await db
    .update(newsroomReviewQueue)
    .set({
      status: body.status,
      reviewerNotes: body.reviewerNotes,
      reviewedBy: session.username,
      reviewedAt: new Date(),
    })
    .where(eq(newsroomReviewQueue.id, id))
    .returning();
  return NextResponse.json(updated);
}

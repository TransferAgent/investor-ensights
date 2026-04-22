import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomReviewQueue, newsroomPipelineJobs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";
import { z } from "zod";

const schema = z.object({
  jobId: z.string().uuid(),
  citySlug: z.string(),
  draftPayload: z.record(z.string(), z.any()),
  qcScore: z.number().int().optional(),
  qcNotes: z.string().optional(),
});

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = schema.parse(await req.json());
  const [row] = await db
    .insert(newsroomReviewQueue)
    .values({
      jobId: body.jobId,
      citySlug: body.citySlug,
      draftPayload: body.draftPayload,
      qcScore: body.qcScore,
      qcNotes: body.qcNotes,
      status: "pending",
    })
    .returning();
  await db
    .update(newsroomPipelineJobs)
    .set({ status: "completed", currentStage: "review", updatedAt: new Date() })
    .where(eq(newsroomPipelineJobs.id, body.jobId));
  return NextResponse.json(row, { status: 201 });
}

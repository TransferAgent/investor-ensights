import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { jobId, currentStage } = (await req.json()) as { jobId: string; currentStage?: string };
  await db
    .update(newsroomPipelineJobs)
    .set({ heartbeatAt: new Date(), currentStage: currentStage ?? undefined, updatedAt: new Date() })
    .where(eq(newsroomPipelineJobs.id, jobId));
  return NextResponse.json({ ok: true });
}

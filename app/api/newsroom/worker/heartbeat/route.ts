import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { jobId, currentStage, workerId } = (await req.json()) as {
    jobId: string;
    currentStage?: string;
    workerId?: string;
  };
  const conds = [
    eq(newsroomPipelineJobs.id, jobId),
    eq(newsroomPipelineJobs.status, "running"),
  ];
  if (workerId) conds.push(eq(newsroomPipelineJobs.claimedBy, workerId));
  const updated = await db
    .update(newsroomPipelineJobs)
    .set({ heartbeatAt: new Date(), currentStage: currentStage ?? undefined, updatedAt: new Date() })
    .where(and(...conds))
    .returning({ id: newsroomPipelineJobs.id });
  if (updated.length === 0) {
    return NextResponse.json(
      { ok: false, error: "lease lost — job is no longer running or was claimed by another worker. Stop work and re-claim." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}

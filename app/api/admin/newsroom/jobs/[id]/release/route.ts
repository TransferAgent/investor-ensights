import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const [updated] = await db
    .update(newsroomPipelineJobs)
    .set({
      status: "queued",
      claimedBy: null,
      claimedAt: null,
      heartbeatAt: null,
      currentStage: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(newsroomPipelineJobs.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "job not found" }, { status: 404 });

  await logAuditEvent({
    username: session.username,
    action: "update",
    entityType: "newsroom_job",
    entityId: id,
    details: { action: "release_lease", forced: true },
  });

  return NextResponse.json(updated);
}

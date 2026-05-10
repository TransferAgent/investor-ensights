import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";
import { withAdminAuth } from "@/lib/auth-middleware";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdminAuth(async (session) => {

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
  });
}

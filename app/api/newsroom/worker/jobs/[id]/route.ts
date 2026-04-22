import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["queued", "running", "completed", "failed"]).optional(),
  currentStage: z.string().optional(),
  agentsCompleted: z.array(z.string()).optional(),
  errorMessage: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = schema.parse(await req.json());
  const [row] = await db
    .update(newsroomPipelineJobs)
    .set({ ...body, heartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(newsroomPipelineJobs.id, id))
    .returning();
  return NextResponse.json(row);
}

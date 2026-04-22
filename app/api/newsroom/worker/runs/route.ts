import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgentRuns } from "@shared/schema";
import { verifyWorkerSecret } from "@/lib/newsroom";
import { z } from "zod";

const schema = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  citySlug: z.string().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  dryRun: z.boolean().optional().default(false),
  input: z.record(z.string(), z.any()).optional().default({}),
  output: z.record(z.string(), z.any()).optional(),
  errorMessage: z.string().optional(),
  tokensUsed: z.number().int().optional(),
  costUsd: z.number().optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = schema.parse(await req.json());
  const [row] = await db
    .insert(newsroomAgentRuns)
    .values({
      agentId: body.agentId,
      jobId: body.jobId,
      citySlug: body.citySlug,
      status: body.status,
      dryRun: body.dryRun,
      input: body.input,
      output: body.output,
      errorMessage: body.errorMessage,
      tokensUsed: body.tokensUsed,
      costUsd: body.costUsd ? String(body.costUsd) : undefined,
      startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : undefined,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}

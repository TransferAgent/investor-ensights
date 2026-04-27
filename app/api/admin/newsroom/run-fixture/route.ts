import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { runFixturePipeline } from "@/lib/newsroom/fixtureWorker";
import { z } from "zod";

const bodySchema = z.object({
  citySlug: z.string().min(1).max(120).optional().default("worcester-ma"),
});

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { citySlug: string };
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  try {
    const result = await runFixturePipeline({
      citySlug: body.citySlug,
      username: session.username,
    });

    await logAuditEvent({
      username: session.username,
      action: "newsroom_run_fixture",
      entityType: "newsroom_pipeline_jobs",
      entityId: result.jobId,
      details: {
        citySlug: body.citySlug,
        reviewQueueId: result.reviewQueueId,
        stagesCompleted: result.stagesCompleted,
        durationMs: result.durationMs,
        totalTokens: result.totalTokens,
        totalCostUsd: result.totalCostUsd,
      },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[run-fixture] failed:", message, err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 409 }
    );
  }
}

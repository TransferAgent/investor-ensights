import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { runLivePipeline } from "@/lib/newsroom/pipelineWorker";
import { ACTIVE_PROMPT_VERSION, PROMPTS, type PromptVersion } from "@/lib/newsroom/prompts";
import { z } from "zod";

const promptVersionSchema = z.enum(
  Object.keys(PROMPTS) as [PromptVersion, ...PromptVersion[]]
);

const bodySchema = z.object({
  citySlug: z.string().min(1).max(120),
  dryRun: z.boolean().optional().default(false),
  promptVersion: promptVersionSchema.optional(),
});

const COOLDOWN_MS = 30_000;
const lastRunByUser = new Map<string, number>();

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY && !process.env.OpenAi_Key) {
    return NextResponse.json(
      { ok: false, error: "OpenAI API key is not configured (OPENAI_API_KEY or OpenAi_Key)." },
      { status: 503 }
    );
  }

  const lastRunAt = lastRunByUser.get(session.username) ?? 0;
  const sinceLast = Date.now() - lastRunAt;
  if (sinceLast < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - sinceLast) / 1000);
    return NextResponse.json(
      { ok: false, error: `Cooldown active. Wait ${waitSec}s before another live run.` },
      { status: 429 }
    );
  }
  lastRunByUser.set(session.username, Date.now());

  let body: { citySlug: string; dryRun: boolean; promptVersion?: PromptVersion };
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch (err) {
    return NextResponse.json(
      { error: "invalid request body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  try {
    const result = await runLivePipeline({
      citySlug: body.citySlug,
      username: session.username,
      dryRun: body.dryRun,
      promptVersion: body.promptVersion,
    });

    await logAuditEvent({
      username: session.username,
      action: "newsroom_run_live",
      entityType: "newsroom_pipeline_jobs",
      entityId: result.jobId,
      details: {
        citySlug: body.citySlug,
        dryRun: body.dryRun,
        promptVersion: body.promptVersion ?? ACTIVE_PROMPT_VERSION,
        promptVersionRequested: body.promptVersion ?? null,
        reviewQueueId: result.reviewQueueId,
        stagesCompleted: result.stagesCompleted,
        durationMs: result.durationMs,
        totalTokens: result.totalTokens,
        totalCostUsd: result.totalCostUsd,
        modelLabel: result.modelLabel,
      },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[run-live] failed:", message, err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 409 }
    );
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  newsroomPipelineJobs,
  newsroomAgentRuns,
  newsroomReviewQueue,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";

/**
 * GET = preview counts. POST = delete.
 *
 * Purges every fixture row produced by Gate-1-style dry-run jobs:
 *   - newsroom_pipeline_jobs WHERE dry_run = true
 *   - newsroom_agent_runs    WHERE dry_run = true OR job_id IN (those jobs)
 *   - newsroom_review_queue  WHERE job_id IN (those jobs)
 *
 * Real (dry_run=false) jobs and their audit trail are never touched.
 * Idempotent. Audit-logged.
 *
 * Architect's purpose: keep Gate 4's audit trail clean by giving us a
 * one-click reset of POC plumbing fixtures before we cut over to live.
 */

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {

  const dryJobs = await db
    .select({ id: newsroomPipelineJobs.id })
    .from(newsroomPipelineJobs)
    .where(eq(newsroomPipelineJobs.dryRun, true));

  const dryJobIds = dryJobs.map((j) => j.id);

  const dryRuns = await db
    .select({ id: newsroomAgentRuns.id })
    .from(newsroomAgentRuns)
    .where(eq(newsroomAgentRuns.dryRun, true));

  const reviewRows =
    dryJobIds.length === 0
      ? []
      : await db
          .select({ id: newsroomReviewQueue.id })
          .from(newsroomReviewQueue)
          .where(inArray(newsroomReviewQueue.jobId, dryJobIds));

  return NextResponse.json({
    preview: true,
    counts: {
      pipelineJobs: dryJobs.length,
      agentRuns: dryRuns.length,
      reviewQueue: reviewRows.length,
    },
  });
  });
}

export async function POST() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {

  const dryJobs = await db
    .select({ id: newsroomPipelineJobs.id })
    .from(newsroomPipelineJobs)
    .where(eq(newsroomPipelineJobs.dryRun, true));
  const dryJobIds = dryJobs.map((j) => j.id);

  let deletedReview = 0;
  if (dryJobIds.length > 0) {
    const r = await db
      .delete(newsroomReviewQueue)
      .where(inArray(newsroomReviewQueue.jobId, dryJobIds))
      .returning({ id: newsroomReviewQueue.id });
    deletedReview = r.length;
  }

  const deletedRuns = await db
    .delete(newsroomAgentRuns)
    .where(eq(newsroomAgentRuns.dryRun, true))
    .returning({ id: newsroomAgentRuns.id });

  const deletedJobs = await db
    .delete(newsroomPipelineJobs)
    .where(eq(newsroomPipelineJobs.dryRun, true))
    .returning({ id: newsroomPipelineJobs.id });

  await logAuditEvent({
    username: session.username,
    action: "newsroom_sweep_dryrun",
    entityType: "newsroom",
    entityId: "sweep",
    details: {
      pipelineJobs: deletedJobs.length,
      agentRuns: deletedRuns.length,
      reviewQueue: deletedReview,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: {
      pipelineJobs: deletedJobs.length,
      agentRuns: deletedRuns.length,
      reviewQueue: deletedReview,
    },
  });
  });
}

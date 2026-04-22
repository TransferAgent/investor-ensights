import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { sql } from "drizzle-orm";
import { verifyWorkerSecret } from "@/lib/newsroom";

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { workerId } = (await req.json()) as { workerId?: string };
  if (!workerId) return NextResponse.json({ error: "workerId required" }, { status: 400 });

  const result = await db.execute(sql`
    UPDATE newsroom_pipeline_jobs
    SET status = 'running',
        claimed_by = ${workerId},
        claimed_at = NOW(),
        heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE id = (
      SELECT id FROM newsroom_pipeline_jobs
      WHERE status = 'queued'
         OR (status = 'running' AND heartbeat_at < NOW() - INTERVAL '5 minutes')
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

  const rows = (result as any).rows ?? result;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ job: null });
  }
  return NextResponse.json({ job: rows[0] });
}

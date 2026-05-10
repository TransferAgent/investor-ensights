import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomPipelineJobs } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth-middleware";

const createSchema = z.object({
  citySlug: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
  payload: z.record(z.string(), z.any()).optional().default({}),
});

export async function GET(req: Request) {
  return withAdminAuth(async (session) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const rows = status
    ? await db
        .select()
        .from(newsroomPipelineJobs)
        .where(eq(newsroomPipelineJobs.status, status))
        .orderBy(desc(newsroomPipelineJobs.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(newsroomPipelineJobs)
        .orderBy(desc(newsroomPipelineJobs.createdAt))
        .limit(limit);
  return NextResponse.json(rows);
  });
}

export async function POST(req: Request) {
  return withAdminAuth(async (session) => {
  const body = createSchema.parse(await req.json());
  const [job] = await db
    .insert(newsroomPipelineJobs)
    .values({
      citySlug: body.citySlug,
      status: "queued",
      currentStage: "researcher",
      dryRun: body.dryRun,
      payload: body.payload,
    })
    .returning();
  return NextResponse.json(job, { status: 201 });
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgentKnowledge } from "@shared/schema";
import { verifyWorkerSecret } from "@/lib/newsroom";
import { z } from "zod";

const schema = z.object({
  entries: z.array(
    z.object({
      agentId: z.string().uuid(),
      citySlug: z.string().optional(),
      key: z.string(),
      value: z.any(),
      sourceUrl: z.string().optional(),
      confidence: z.number().optional(),
      expiresAt: z.string().datetime().optional(),
    })
  ),
});

export async function POST(req: Request) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = schema.parse(await req.json());
  if (body.entries.length === 0) return NextResponse.json({ inserted: 0 });
  await db.insert(newsroomAgentKnowledge).values(
    body.entries.map((e) => ({
      agentId: e.agentId,
      citySlug: e.citySlug,
      key: e.key,
      value: e.value,
      sourceUrl: e.sourceUrl,
      confidence: e.confidence ? String(e.confidence) : undefined,
      expiresAt: e.expiresAt ? new Date(e.expiresAt) : undefined,
    }))
  );
  return NextResponse.json({ inserted: body.entries.length });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth-middleware";

const patchSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  provider: z.string().optional(),
  modelEndpoint: z.string().optional(),
  providerKeyRef: z.string().optional(),
  systemPrompt: z.string().optional(),
  sources: z.array(z.string()).optional(),
  config: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAdminAuth(async (session) => {
  const { id } = await params;
  const body = patchSchema.parse(await req.json());
  const [updated] = await db
    .update(newsroomAgents)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(newsroomAgents.id, id))
    .returning();
  return NextResponse.json(updated);
  });
}

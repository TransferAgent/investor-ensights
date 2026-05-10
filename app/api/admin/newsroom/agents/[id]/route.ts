import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newsroomAgents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { z } from "zod";
import { withTenantAsync } from "@/lib/tenant/context";

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
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {
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

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { newsroomSchedulerConfig } from "@shared/schema";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  pairingsPerDay: z.number().int().min(0).max(50).optional(),
  dailyBudgetUsd: z.number().nonnegative().max(100).optional(),
  pickerStrategy: z.enum(["balanced", "newest_first", "random"]).optional(),
  pausedReason: z.string().max(500).nullable().optional(),
});

async function ensureConfig() {
  const [row] = await db.select().from(newsroomSchedulerConfig).where(eq(newsroomSchedulerConfig.id, "singleton")).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(newsroomSchedulerConfig)
    .values({ id: "singleton", enabled: false, pairingsPerDay: 5, dailyBudgetUsd: "1.0000", pickerStrategy: "balanced" })
    .returning();
  return created;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {
  const config = await ensureConfig();
  return NextResponse.json({ config, cronSecretSet: Boolean(process.env.CRON_SECRET) });
  });
}

export async function PATCH(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenantAsync(session.tenantSlug, async () => {

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (e: unknown) {
    return NextResponse.json({ error: "invalid body", details: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  await ensureConfig();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.enabled !== undefined) updates.enabled = parsed.enabled;
  if (parsed.pairingsPerDay !== undefined) updates.pairingsPerDay = parsed.pairingsPerDay;
  if (parsed.dailyBudgetUsd !== undefined) updates.dailyBudgetUsd = String(parsed.dailyBudgetUsd);
  if (parsed.pickerStrategy !== undefined) updates.pickerStrategy = parsed.pickerStrategy;
  if (parsed.pausedReason !== undefined) updates.pausedReason = parsed.pausedReason;

  const [updated] = await db
    .update(newsroomSchedulerConfig)
    .set(updates)
    .where(eq(newsroomSchedulerConfig.id, "singleton"))
    .returning();

  await logAuditEvent({
    username: session.username,
    action: "scheduler.config.update",
    entityType: "newsroom_scheduler_config",
    entityId: "singleton",
    details: parsed as Record<string, unknown>,
  });

  return NextResponse.json({ config: updated });
  });
}

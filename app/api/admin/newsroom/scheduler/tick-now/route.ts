import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { runSchedulerTick } from "@/lib/newsroom/schedulerRunner";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await runSchedulerTick({ triggeredBy: "manual", username: session.username });
    await logAuditEvent({
      username: session.username,
      action: "scheduler.tick.manual",
      entityType: "newsroom_scheduler",
      entityId: "singleton",
      details: { outcome: result.outcome, citySlug: result.citySlug, hayloArticleId: result.hayloArticleId },
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

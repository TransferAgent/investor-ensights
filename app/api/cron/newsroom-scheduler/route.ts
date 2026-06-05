import { NextRequest, NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/newsroom/schedulerRunner";
import { runCityMetaSweep } from "@/lib/cities/cityMetaSweeper";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * City-meta sweep budget per newsroom tick. The newsroom heartbeat is the
 * trusted, already-scheduled trigger, so the city-meta sweeper rides along on
 * it (zero extra setup, "meta fills itself"). Kept modest so a backlog drains
 * over successive ticks WITHOUT risking the 120s budget the article pipeline
 * already consumes. When no cities are eligible the sweep is ~2 cheap COUNT
 * queries per tenant — effectively free.
 */
const CITY_META_SWEEP_PER_TICK = 10;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === expected) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${expected}`) return true;
  return false;
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured on the server." },
      { status: 503 }
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Article publishing runs FIRST and is fully awaited/committed before the
    // city-meta sweep starts, so the sweep can never affect publishing.
    const result = await runSchedulerTick({ triggeredBy: "cron" });

    // Piggyback the reconciling city-meta sweep on the same heartbeat. Wrapped
    // so a sweep failure (or its internal in-flight guard) can never turn a
    // successful publish tick into a 500. Forward-only + idempotent: whatever
    // it doesn't reach this tick, the next tick continues.
    let cityMeta: unknown;
    try {
      cityMeta = await runCityMetaSweep({
        triggeredBy: "cron",
        username: "newsroom-cron",
        limit: CITY_META_SWEEP_PER_TICK,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      cityMeta = { ok: false, error: `city-meta sweep failed: ${msg}` };
    }

    return NextResponse.json({ ok: true, result, cityMeta });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

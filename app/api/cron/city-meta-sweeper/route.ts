import { NextRequest, NextResponse } from "next/server";
import { runCityMetaSweep } from "@/lib/cities/cityMetaSweeper";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
      { status: 503 },
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam != null && limitParam !== "" ? Number(limitParam) : undefined;
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const result = await runCityMetaSweep({ triggeredBy: "cron", limit, dryRun });
    return NextResponse.json({ ok: true, result });
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

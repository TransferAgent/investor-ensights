#!/usr/bin/env node
// Optional dedicated trigger for the city-meta reconciling sweeper.
//
// The sweeper ALSO rides along on every newsroom-scheduler tick
// (see app/api/cron/newsroom-scheduler/route.ts), so in most setups you do not
// need this at all. Use this only if you want a SEPARATE cadence — e.g. a
// Replit Scheduled Deployment running every 60 minutes with the command:
//
//     node scripts/city-meta-sweep-tick.mjs
//
// It POSTs to the CRON_SECRET-gated sweep route against the production base URL.
// Forward-only + idempotent: safe to run as often as you like; the route's
// in-flight guard and per-row TOCTOU writes make overlapping runs harmless.
const SECRET = process.env.CRON_SECRET;
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com";
const LIMIT = process.env.CITY_META_SWEEP_LIMIT || "25";

if (!SECRET) {
  console.error("CRON_SECRET is not set on this deployment.");
  process.exit(1);
}

const url = `${BASE.replace(/\/$/, "")}/api/cron/city-meta-sweeper?limit=${encodeURIComponent(LIMIT)}`;
const startedAt = Date.now();

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": SECRET, "content-type": "application/json" },
    body: "{}",
  });
  const text = await res.text();
  const elapsed = Date.now() - startedAt;
  console.log(`[city-meta-sweep] ${res.status} in ${elapsed}ms — ${text.slice(0, 500)}`);
  if (!res.ok) process.exit(2);

  // Surface a failed sweep run as a non-zero exit so a Scheduled Deployment
  // marks the run failed instead of silently succeeding on HTTP 200. A run
  // that merely found nothing to do, or was skipped because another sweep was
  // already in flight, is NOT a failure.
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const inner = body && typeof body === "object" ? body.result : null;
  if (inner && inner.ok === false) {
    const note = String(inner.notes ?? "");
    const benign =
      note === "another sweep is already running" ||
      note.startsWith("OPENAI_API_KEY");
    if (!benign) {
      console.error(`[city-meta-sweep] sweep reported failure: ${note || "ok=false"}`);
      process.exit(4);
    }
  }
} catch (err) {
  console.error(`[city-meta-sweep] request failed:`, err);
  process.exit(3);
}

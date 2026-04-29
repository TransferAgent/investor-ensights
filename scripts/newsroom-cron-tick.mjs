#!/usr/bin/env node
const SECRET = process.env.CRON_SECRET;
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";

if (!SECRET) {
  console.error("CRON_SECRET is not set on this deployment.");
  process.exit(1);
}

const url = `${BASE.replace(/\/$/, "")}/api/cron/newsroom-scheduler`;
const startedAt = Date.now();

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-cron-secret": SECRET, "content-type": "application/json" },
    body: "{}",
  });
  const text = await res.text();
  const elapsed = Date.now() - startedAt;
  console.log(`[newsroom-cron] ${res.status} in ${elapsed}ms — ${text.slice(0, 500)}`);
  if (!res.ok) process.exit(2);
} catch (err) {
  console.error(`[newsroom-cron] request failed:`, err);
  process.exit(3);
}

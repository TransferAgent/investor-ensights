---
name: Multi-tenant cron jobs
description: Why a context-less cron only touches ONE tenant, and how to write one that sweeps all tenants
---

# Multi-tenant cron jobs must loop tenants explicitly

`db` / `storage` are tenant-aware proxies that resolve the tenant from
AsyncLocalStorage, and **fall back to `DEFAULT_TENANT_SLUG` ("tableicity") when
no context is set** (see `lib/db.ts` + `lib/tenant/context.ts`). So a cron route
that just calls a runner with no `withTenantAsync` wrapper silently operates on
ONE tenant only — the default. The existing newsroom scheduler
(`app/api/cron/newsroom-scheduler`) is exactly this: effectively single-tenant
today because it never loops.

**Why it matters:** "mirror the scheduler" does NOT mean "copy its single-tenant
behavior." A correct multi-tenant cron must:
1. Enumerate `public.tenants` itself, wrapped in `withTenantAsync(DEFAULT_TENANT_SLUG, …)`
   so it still resolves even when `TENANT_DEFAULT_SLUG` is set to "" (the refusal
   guard that makes context-less access throw).
2. Run each tenant's work inside its own `withTenantAsync(slug, …)` so reads AND
   writes scope to that tenant's schema.

**How to apply:** any new cron/sweeper/batch job that should cover every tenant —
follow the `lib/cities/cityMetaSweeper.ts` pattern (enumerate-then-per-tenant),
not the bare `runSchedulerTick()` pattern.

# Triggering a cron automatically on Replit

Nothing in the repo schedules the cron *routes* — a Next.js route only runs when
pinged. The schedule lives in Replit's deployment UI (a **Scheduled
Deployment**), which the agent cannot create programmatically and cannot see from
the dev container. So you can never "confirm from code" that a cron auto-runs.

Two ways to make a route fire automatically:
1. **Ride-along on an already-scheduled heartbeat** (zero new setup). The
   city-meta sweep is invoked at the end of `app/api/cron/newsroom-scheduler`
   after the article tick. Best when a trusted cron already runs.
2. **Dedicated Scheduled Deployment** — a tiny tick script (see
   `scripts/*-cron-tick.mjs`) that POSTs to the route with `CRON_SECRET`; the
   user points a Scheduled Deployment at `node scripts/<x>.mjs`. Requires a
   one-time UI step by the user.

**Why / how to apply (piggyback safety):** the host route runs on autoscale with
a hard `maxDuration` (120s) and `setInterval`/fire-and-forget get killed when the
response returns — so extra work MUST be awaited, and bounded by BOTH an attempt
limit AND a wall-clock deadline relative to request start (not just a count). Run
the critical work (publishing) FIRST and let it commit, then do the piggyback in
its own try/catch so it can never fail the host. Also give external API calls a
per-request timeout — without one the SDK default (OpenAI: 10 min) can blow the
route budget from a single hung call.

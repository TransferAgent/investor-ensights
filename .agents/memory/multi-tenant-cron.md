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

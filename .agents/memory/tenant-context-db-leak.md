---
name: Tenant-context leak in direct-db routes
description: Admin/API routes that use raw `db` without withTenantAsync silently read/write the default tenant (tableicity), not the session tenant.
---

# Tenant-context leak in direct-`db` routes

Any route/handler that touches the raw `db` connection (drizzle `db.select/update/insert/execute`)
**without** wrapping the work in `withTenantAsync(session.tenantSlug, async () => {…})` will resolve
its schema via `getCurrentTenantSlug()`, which falls back to `DEFAULT_TENANT_SLUG = "tableicity"`
(see `lib/tenant/context.ts`) when no AsyncLocalStorage tenant is set. Result: it silently reads —
or worse, **writes** — the default tenant's data regardless of which tenant the user is viewing.

**Why:** symptom seen in the Knowledge admin dashboard — the metric/analytics/coverage cards showed
tableicity's counts (e.g. "Pending: 8") while the article *list* (correctly wrapped) showed the
session tenant's true count (texitie → 1). User read it as "deleted articles are hidden"; nothing was
hidden — it was a display leak from two different tenant contexts on one screen.

**How to apply:**
- `storage.*` calls are generally tenant-safe (proxied through the session-tenant path). Direct `db.*`
  calls are NOT — they need an explicit `withTenantAsync` wrapper.
- When adding/auditing an admin route, grep the `app/api/admin/**` surface: if a route imports
  `@/lib/db` and has no `withTenantAsync`/`withTenant`, it is leaking to the default tenant.
- Copy the pattern from `app/api/admin/knowledge/route.ts` GET: after the `verifySession` check,
  `return withTenantAsync(session.tenantSlug, async () => { …body… });`.
- Same root class as the cron-job leak (see multi-tenant-cron.md) — context-less DB access defaults to tableicity.

import type pg from "pg";
import { getTenantDb, getTenantPool } from "./tenant/pools";
import { requireCurrentTenantSlug } from "./tenant/context";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// MT-1 (2026-05-09): `db` and `pool` are now tenant-aware proxies.
//
// Every property access resolves the current tenant from AsyncLocalStorage,
// falling back to TENANT_DEFAULT_SLUG (default: "tableicity"). All 42 existing
// importers continue to work without changes — until MT-3 moves data into
// tenant schemas, every tenant resolves to `public`, so behavior is unchanged.
//
// Refusal guardrail: set `TENANT_DEFAULT_SLUG=` (empty) and any access without
// a wrapping `withTenant(slug, fn)` will throw loudly. This satisfies MT-1 DoD
// item (d) — see John/Locked_Gate_Table_MultiTenant_v1.0.md.

type TenantDb = ReturnType<typeof getTenantDb>;

// MT-4.8: dev-mode guard. When `db` is accessed outside any ALS tenant
// context, the proxy falls back to TENANT_DEFAULT_SLUG (tableicity). That's
// intentional for cron/worker/seed paths — but it's also a silent footgun
// for admin routes that forgot to wrap with withAdminAuth. Log a one-shot
// stack trace per call site in non-production so missed wraps are visible.
// Uses hasTenantContext() so users genuinely on the tableicity tenant don't
// trigger false positives.
import { hasTenantContext } from "./tenant/context";
import { DEFAULT_TENANT_SLUG } from "./tenant/context";
const warnedCallSites = new Set<string>();
function warnIfFallback(): void {
  if (process.env.NODE_ENV === "production") return;
  if (hasTenantContext()) return;  // explicit context — never a fallback
  const stack = new Error().stack ?? "";
  // Skip frames: Error, warnIfFallback, Proxy.get, drizzle-internal call.
  const frame = stack.split("\n").slice(4, 5).join("") || "<unknown>";
  if (warnedCallSites.has(frame)) return;
  warnedCallSites.add(frame);
  // eslint-disable-next-line no-console
  console.warn(
    `[tenant-fallback] db accessed outside any tenant context — using default "${DEFAULT_TENANT_SLUG}". ` +
    `If this is an admin route, wrap it with withAdminAuth(). Frame:${frame}`
  );
}

function proxyForTenantResource<T extends object>(resolve: (slug: string) => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      warnIfFallback();
      const slug = requireCurrentTenantSlug();
      const real = resolve(slug) as Record<string | symbol, unknown>;
      const value = real[prop];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(real);
      }
      return value;
    },
  });
}

export const db: TenantDb = proxyForTenantResource(getTenantDb);
export const pool: pg.Pool = proxyForTenantResource(getTenantPool);

// Re-export tenant context utilities so new code can do
// `import { withTenant } from "@/lib/db"`.
export {
  withTenant,
  withTenantAsync,
  getCurrentTenantSlug,
  requireCurrentTenantSlug,
  DEFAULT_TENANT_SLUG,
} from "./tenant/context";
export { getTenantDb, getTenantPool } from "./tenant/pools";

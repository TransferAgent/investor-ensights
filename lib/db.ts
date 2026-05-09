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

function proxyForTenantResource<T extends object>(resolve: (slug: string) => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
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

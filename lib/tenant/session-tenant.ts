import { headers } from "next/headers";
import { readTenantFromCookie } from "../auth";
import { withTenantAsync } from "./context";

const ADMIN_HEADER = "x-ie-admin-context";

// In-memory cache of "tenant slug exists in public.tenants" with a short TTL.
// Used by withSessionTenant to reject stale cookies pointing at deleted/
// non-existent tenants WITHOUT a per-request DB round-trip.
const tenantExistsCache = new Map<string, { ok: boolean; checkedAt: number }>();
const TENANT_CHECK_TTL_MS = 60_000; // 60s

async function tenantExists(slug: string): Promise<boolean> {
  const cached = tenantExistsCache.get(slug);
  const now = Date.now();
  if (cached && now - cached.checkedAt < TENANT_CHECK_TTL_MS) return cached.ok;

  // Lazy import to avoid circular deps (storage → session-tenant → db → ...).
  const { getTenantPool } = await import("./pools");
  // Use the `tableicity` pool (or any existing pool) for the SELECT —
  // public.tenants is in the public schema and resolves under any search_path.
  const pool = getTenantPool("tableicity");
  try {
    const r = await pool.query(`SELECT 1 FROM public.tenants WHERE slug = $1`, [slug]);
    const ok = (r.rowCount ?? 0) > 0;
    tenantExistsCache.set(slug, { ok, checkedAt: now });
    return ok;
  } catch {
    // If we can't verify, fall through (don't grant access).
    return false;
  }
}

// MT-6 silo enforcement: every storage method runs inside this wrapper so
// the user's tenant context is automatically picked up from the admin
// session cookie — zero per-route changes needed.
//
// Resolution:
//   1. Check the `x-ie-admin-context` header set by middleware.ts. ONLY
//      consume the admin cookie on admin paths — public routes must not
//      have their tenant flipped by an incidental admin login.
//   2. Read admin_session cookie. If valid, decode tenantSlug.
//   3. Verify the tenant still exists (60s cache) — defence against stale
//      cookies pointing at deleted tenants.
//   4. Run the storage operation inside withTenantAsync(tenantSlug, ...).
//   5. Otherwise (public requests, CLI scripts, deleted tenants), fall
//      through to whatever tenant context is already set (env default, or
//      any explicit withTenant wrap higher up).
export async function withSessionTenant<T>(fn: () => Promise<T>): Promise<T> {
  let isAdminContext = false;
  try {
    const h = await headers();
    isAdminContext = h.get(ADMIN_HEADER) === "1";
  } catch {
    // Outside request context (CLI scripts) — not admin.
  }

  if (!isAdminContext) return fn();

  const tenantSlug = await readTenantFromCookie();
  if (!tenantSlug) return fn();

  const ok = await tenantExists(tenantSlug);
  if (!ok) return fn();

  return withTenantAsync(tenantSlug, fn);
}

// Test-only: clear the tenant-exists cache.
export function _resetTenantExistsCacheForTesting() {
  tenantExistsCache.clear();
}

// MT-1: this file is a duplicate of lib/db.ts with zero importers in the
// current codebase. Re-exporting from lib/db.ts to keep the tenant-aware
// proxies as the single source of truth — if anyone discovers and imports
// from here in the future, they get the same tenant routing as everyone
// else, not a bypass.

export {
  db,
  pool,
  withTenant,
  withTenantAsync,
  getCurrentTenantSlug,
  requireCurrentTenantSlug,
  DEFAULT_TENANT_SLUG,
  getTenantDb,
  getTenantPool,
} from "@/lib/db";

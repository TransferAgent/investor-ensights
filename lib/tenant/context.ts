import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = { slug: string };

const als = new AsyncLocalStorage<TenantContext>();

export const DEFAULT_TENANT_SLUG = "tableicity";

function getDefaultSlug(): string | null {
  const env = process.env.TENANT_DEFAULT_SLUG;
  if (env === undefined) return DEFAULT_TENANT_SLUG;
  if (env === "") return null;
  return env;
}

export function getCurrentTenantSlug(): string | null {
  return als.getStore()?.slug ?? getDefaultSlug();
}

export function requireCurrentTenantSlug(): string {
  const slug = getCurrentTenantSlug();
  if (!slug) {
    throw new Error(
      "Tenant context required: no tenant in AsyncLocalStorage and TENANT_DEFAULT_SLUG is empty. " +
      "Wrap the call site with withTenant(slug, fn) or set TENANT_DEFAULT_SLUG.",
    );
  }
  return slug;
}

export function withTenant<T>(slug: string, fn: () => T): T {
  return als.run({ slug }, fn);
}

export async function withTenantAsync<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ slug }, fn);
}

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pools = new Map<string, pg.Pool>();
const dbs = new Map<string, ReturnType<typeof drizzle<typeof schema>>>();

// Strict slug validator. Tenant slugs become Postgres schema names AND
// public URL prefixes (per D5 in the locked gate), so we lock them down to
// lowercase alphanumeric + underscore. Reject anything else loudly.
const SLUG_RE = /^[a-z][a-z0-9_]{0,62}$/;

function assertValidSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `Invalid tenant slug "${slug}". Tenant slugs must match ${SLUG_RE} ` +
      `(lowercase, starts with a letter, max 63 chars, no quotes/hyphens).`,
    );
  }
}

function buildPool(slug: string): pg.Pool {
  // `options` is sent in the Postgres startup packet, so search_path is set
  // BEFORE any query can run on the connection — no race window between
  // checkout and first query. tenant_<slug> may not exist yet (MT-2 creates
  // it; MT-3 moves data). Postgres tolerates a non-existent search_path
  // entry until you query a table that lives only in the missing schema, so
  // during MT-1 every tenant effectively resolves to `public`.
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path="tenant_${slug}",public`,
  });
}

export function getTenantPool(slug: string): pg.Pool {
  let pool = pools.get(slug);
  if (!pool) {
    assertValidSlug(slug);
    pool = buildPool(slug);
    pools.set(slug, pool);
  }
  return pool;
}

export function getTenantDb(slug: string) {
  let d = dbs.get(slug);
  if (!d) {
    d = drizzle(getTenantPool(slug), { schema });
    dbs.set(slug, d);
  }
  return d;
}

// Test-only: clear cached pools/dbs. Not used in production.
export function _resetTenantCachesForTesting() {
  for (const pool of pools.values()) {
    void pool.end().catch(() => undefined);
  }
  pools.clear();
  dbs.clear();
}

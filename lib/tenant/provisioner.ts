// MT-2: idempotent tenant schema provisioning. See gate doc §D1, §D10.
//
// IMPORTANT SEQUENCING RULE (added in MT-2 close after architect review):
// MT-1 sets search_path="tenant_<slug>",public. Once a tenant_<slug> schema
// exists with empty per-tenant table SHELLS, reads silently resolve there
// instead of falling through to populated public tables — making the app
// look empty even though no data was deleted. Therefore:
//
//   provisionTenantSchema MUST be called ONLY from inside MT-3's data-move
//   transaction (provision → copy → commit), never standalone in any
//   environment that reads via the tenant-aware client.
//
// scripts/mt2-verify.ts exercises it in a self-contained provision→check→
// drop cycle so live state remains tenant-schema-free until MT-3.

import type { Pool } from "pg";
import { PER_TENANT_TABLES } from "./perTenantTables";

const VALID_SLUG = /^[a-z][a-z0-9_]{0,62}$/;
const VALID_TABLE = /^[a-z_][a-z0-9_]*$/;
const RESERVED_SLUGS = new Set([
  "public", "pg_catalog", "pg_toast", "information_schema",
  "admin", "api", "www", "tenant", "platform",
]);

export function assertValidSlug(slug: string): void {
  if (!VALID_SLUG.test(slug)) {
    throw new Error(`Invalid tenant slug "${slug}" (must match ${VALID_SLUG}).`);
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`Tenant slug "${slug}" is reserved.`);
  }
}

export interface ProvisionResult {
  slug: string;
  schema: string;
  tablesCreated: string[];
  tablesAlreadyPresent: string[];
}

// Each shell uses CREATE TABLE ... (LIKE public.<name> INCLUDING ALL),
// which copies columns, types, defaults, CHECK constraints, indexes,
// comments, and storage params. NOT copied: foreign keys (PG semantics) —
// these are reconstructed at MT-3 alongside the data move.
export async function provisionTenantSchema(pool: Pool, slug: string): Promise<ProvisionResult> {
  assertValidSlug(slug);
  const schema = `tenant_${slug}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    const created: string[] = [];
    const present: string[] = [];
    for (const table of PER_TENANT_TABLES) {
      if (!VALID_TABLE.test(table)) {
        throw new Error(`Invalid table name "${table}" in PER_TENANT_TABLES`);
      }
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
        [schema, table]
      );
      if ((exists.rowCount ?? 0) > 0) { present.push(table); continue; }
      const src = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      if ((src.rowCount ?? 0) === 0) {
        throw new Error(`Source public."${table}" missing; run db:push first.`);
      }
      await client.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
      created.push(table);
    }
    await client.query("COMMIT");
    return { slug, schema, tablesCreated: created, tablesAlreadyPresent: present };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function tenantSchemaExists(pool: Pool, slug: string): Promise<boolean> {
  assertValidSlug(slug);
  const r = await pool.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    [`tenant_${slug}`]
  );
  return (r.rowCount ?? 0) > 0;
}

// Used by the MT-2 verifier and by MT-3 rollback paths. Cascades because
// we only call this on the empty-shell state immediately after provision.
export async function dropTenantSchema(pool: Pool, slug: string): Promise<void> {
  assertValidSlug(slug);
  await pool.query(`DROP SCHEMA IF EXISTS "tenant_${slug}" CASCADE`);
}

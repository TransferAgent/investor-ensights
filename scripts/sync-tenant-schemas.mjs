#!/usr/bin/env node
/**
 * sync-tenant-schemas.mjs
 *
 * Schema-per-tenant safety net.
 *
 * Drizzle Kit only knows about the `public` schema. In our multi-tenant model
 * every per-tenant table (haylo_articles, knowledge_articles, city_locations,
 * etc.) lives in BOTH `public` AND in each `tenant_<slug>` schema. After
 * every `npm run db:push` (dev) or `bash scripts/push-schema-to-prod.sh`
 * (prod), the new columns/indexes only exist in `public` and the tenant
 * schemas silently drift, causing "column does not exist" errors at runtime
 * (which the UI usually swallows as "0 results").
 *
 * This script reconciles each per-tenant table in every `tenant_<slug>`
 * schema against its `public` counterpart by:
 *   1. ADDing any missing column with the same data type, nullability, and
 *      default expression.
 *   2. RELAXing NOT NULL constraints if the public copy is now nullable
 *      (forward-only, never tightens).
 *   3. CREATEing any missing index (best effort — partial unique indexes
 *      from drizzle are reproduced by name).
 *
 * It will NEVER:
 *   - drop a column, table, or index
 *   - tighten a constraint (NULL → NOT NULL)
 *   - rename anything
 *   - touch row data
 *
 * Usage:
 *   node scripts/sync-tenant-schemas.mjs            # uses DATABASE_URL (dev)
 *   node scripts/sync-tenant-schemas.mjs --prod     # uses PROD_DATABASE_URL
 *   node scripts/sync-tenant-schemas.mjs --dry-run  # show actions, write none
 */

import pg from "pg";

const args = new Set(process.argv.slice(2));
const isProd = args.has("--prod");
const dryRun = args.has("--dry-run");
const url = isProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
const label = isProd ? "PROD" : "DEV";

if (!url) {
  console.error(`Missing ${isProd ? "PROD_DATABASE_URL" : "DATABASE_URL"}.`);
  process.exit(1);
}

const PER_TENANT_TABLES = [
  "admin_audit_log",
  "city_locations",
  "city_content_assignments",
  "city_research_sources",
  "knowledge_articles",
  "knowledge_article_versions",
  "knowledge_templates",
  "knowledge_campaigns",
  "knowledge_generation_log",
  "content_templates",
  "custom_pages",
  "page_slides",
  "haylo_articles",
  "data_store_files",
];

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log(`\n=== ${label} ${dryRun ? "(DRY RUN) " : ""}===`);

const sch = await c.query(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY 1`
);
const tenantSchemas = sch.rows.map((r) => r.schema_name);
console.log(`tenant schemas: ${tenantSchemas.join(", ") || "(none)"}\n`);

let actionCount = 0;
async function run(sql, params = []) {
  if (dryRun) {
    console.log(`  [DRY] ${sql}`);
    actionCount++;
    return;
  }
  await c.query(sql, params);
  actionCount++;
}

async function colDef(schema, table) {
  const r = await c.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return new Map(r.rows.map((row) => [row.column_name, row]));
}

function fullType(col) {
  // Prefer udt_name for full fidelity (e.g. "varchar", "int4", "timestamptz").
  const udt = col.udt_name;
  if (udt === "varchar" && col.character_maximum_length) return `varchar(${col.character_maximum_length})`;
  if (udt === "numeric" && col.numeric_precision) {
    return col.numeric_scale ? `numeric(${col.numeric_precision},${col.numeric_scale})` : `numeric(${col.numeric_precision})`;
  }
  // Common aliases
  if (udt === "int4") return "integer";
  if (udt === "int8") return "bigint";
  if (udt === "timestamptz") return "timestamp with time zone";
  if (udt === "timestamp") return "timestamp";
  if (udt === "bool") return "boolean";
  return udt;
}

async function indexes(schema, table) {
  const r = await c.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1 AND tablename = $2`,
    [schema, table]
  );
  return new Map(r.rows.map((row) => [row.indexname, row.indexdef]));
}

for (const table of PER_TENANT_TABLES) {
  const exists = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table]
  );
  if (exists.rowCount === 0) continue;

  const publicCols = await colDef("public", table);
  const publicIdx = await indexes("public", table);

  for (const schema of tenantSchemas) {
    const exists2 = await c.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
      [schema, table]
    );
    if (exists2.rowCount === 0) continue;

    const tCols = await colDef(schema, table);
    const tIdx = await indexes(schema, table);

    // 1. Add missing columns.
    for (const [name, col] of publicCols) {
      if (tCols.has(name)) continue;
      const type = fullType(col);
      const nul = col.is_nullable === "NO" ? " NOT NULL" : "";
      const def = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(`+ ${schema}.${table}.${name} (${type}${nul}${def})`);
      await run(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS "${name}" ${type}${def}${nul}`);
    }

    // 2. Relax NOT NULL where public has been relaxed. Forward-only.
    for (const [name, col] of publicCols) {
      const tcol = tCols.get(name);
      if (!tcol) continue;
      if (col.is_nullable === "YES" && tcol.is_nullable === "NO") {
        console.log(`~ ${schema}.${table}.${name} DROP NOT NULL`);
        await run(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${name}" DROP NOT NULL`);
      }
    }

    // 3. Add missing indexes (best-effort; rewrite the public DDL for the tenant schema).
    for (const [iname, idef] of publicIdx) {
      // Skip the implicit pkey — Postgres creates it with the table.
      if (iname.endsWith("_pkey")) continue;
      if (tIdx.has(iname)) continue;
      // Rewrite "ON public.table" → "ON tenant_x.table"
      const rewritten = idef.replace(/ON public\./g, `ON ${schema}.`);
      console.log(`+ index ${schema}.${iname}`);
      try {
        await run(rewritten);
      } catch (e) {
        // If the index name conflicts globally, skip — Postgres index names
        // are schema-scoped so this should be rare.
        console.log(`  (skipped: ${e.message})`);
      }
    }
  }
}

console.log(`\n${dryRun ? "Would apply" : "Applied"} ${actionCount} change(s).`);
await c.end();

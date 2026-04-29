/**
 * sync-dev-to-prod.ts
 *
 * Mirrors all application data from the Dev database (DATABASE_URL) into the
 * Production database (env var `engineer1_prod_db`). Intended to be run
 * immediately before publishing so that Prod matches Dev exactly.
 *
 * Safety:
 *   - Refuses to run if DEV and PROD point at the same host+database.
 *   - Wraps the mirror in a single transaction on Prod (rolls back on any error).
 *   - Inserts in foreign-key dependency order computed dynamically from
 *     information_schema, so no constraint hacks are required.
 *   - Resets sequences for any serial columns after insert.
 *   - Default mode is `--dry-run` (counts only). Pass `--confirm` to actually
 *     write to Prod.
 *
 * Usage:
 *   npx tsx scripts/sync-dev-to-prod.ts                # dry run (no writes)
 *   npx tsx scripts/sync-dev-to-prod.ts --confirm      # actually mirror
 */

import pg from "pg";

const DEV_URL = process.env.DATABASE_URL;
const PROD_URL = process.env.PROD_DATABASE_URL;

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has("--confirm");

if (!DEV_URL) {
  console.error("Missing DATABASE_URL (dev).");
  process.exit(1);
}
if (!PROD_URL) {
  console.error("Missing env var 'PROD_DATABASE_URL' (prod connection string).");
  process.exit(1);
}
if (DEV_URL === PROD_URL) {
  console.error("DEV and PROD URLs are identical — refusing to sync.");
  process.exit(1);
}

function makePool(url: string) {
  return new pg.Pool({
    connectionString: url,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 4,
  });
}

async function topoSort(prod: pg.Pool): Promise<string[]> {
  // Get all base tables in public schema
  const tablesRes = await prod.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const tables = tablesRes.rows.map((r) => r.table_name);

  // Build dependency map: table -> set of tables it depends on (parents)
  const fkRes = await prod.query<{ child: string; parent: string }>(`
    SELECT
      tc.table_name AS child,
      ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  const deps = new Map<string, Set<string>>();
  for (const t of tables) deps.set(t, new Set());
  for (const { child, parent } of fkRes.rows) {
    if (child === parent) continue; // self-reference
    if (!deps.has(child)) deps.set(child, new Set());
    deps.get(child)!.add(parent);
  }

  // Kahn's algorithm
  const order: string[] = [];
  const remaining = new Map(deps);
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, parents]) => parents.size === 0)
      .map(([t]) => t)
      .sort();
    if (ready.length === 0) {
      throw new Error(
        `Cycle detected in FK graph among: ${[...remaining.keys()].join(", ")}`
      );
    }
    for (const t of ready) {
      order.push(t);
      remaining.delete(t);
      for (const [, parents] of remaining) parents.delete(t);
    }
  }
  return order;
}

type ColumnMeta = { name: string; dataType: string };

async function getColumns(pool: pg.Pool, table: string): Promise<ColumnMeta[]> {
  // Skip stored-generated columns and identity-always columns — Postgres
  // forbids inserting into them.
  const res = await pool.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
       AND is_generated <> 'ALWAYS'
       AND COALESCE(identity_generation, '') <> 'ALWAYS'
     ORDER BY ordinal_position`,
    [table]
  );
  return res.rows.map((r) => ({ name: r.column_name, dataType: r.data_type }));
}

function bindValue(v: unknown, dataType: string): unknown {
  if (v === null || v === undefined) return v;
  // node-pg parses jsonb/json as JS objects/arrays; rebinding a JS array
  // would otherwise be serialized as a Postgres array literal. Stringify
  // for JSON columns so the destination receives valid JSON text.
  if ((dataType === "jsonb" || dataType === "json") && typeof v === "object") {
    return JSON.stringify(v);
  }
  return v;
}

async function countRows(pool: pg.Pool, table: string): Promise<number> {
  const res = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM "${table}"`
  );
  return Number(res.rows[0].c);
}

async function main() {
  const dev = makePool(DEV_URL!);
  const prod = makePool(PROD_URL!);

  // Confirm distinct endpoints
  const dInfo = (
    await dev.query<{ host: string; db: string }>(
      `SELECT inet_server_addr()::text AS host, current_database() AS db`
    )
  ).rows[0];
  const pInfo = (
    await prod.query<{ host: string; db: string }>(
      `SELECT inet_server_addr()::text AS host, current_database() AS db`
    )
  ).rows[0];

  console.log(`DEV  → host=${dInfo.host} db=${dInfo.db}`);
  console.log(`PROD → host=${pInfo.host} db=${pInfo.db}`);
  if (dInfo.host === pInfo.host && dInfo.db === pInfo.db) {
    throw new Error("DEV and PROD resolved to same host+db; aborting.");
  }

  // Compute table order
  const order = await topoSort(prod);

  // BEFORE snapshot
  console.log(`\nMode: ${CONFIRM ? "WRITE (--confirm)" : "DRY RUN"}`);
  console.log("\n--- Row counts BEFORE ---");
  console.log(
    `${"TABLE".padEnd(40)}| ${"DEV".padStart(7)} | ${"PROD".padStart(7)} | DIFF`
  );
  console.log("-".repeat(75));
  let totalDiff = 0;
  for (const t of order) {
    const d = await countRows(dev, t);
    const p = await countRows(prod, t);
    const diff = d - p;
    if (diff !== 0) totalDiff++;
    console.log(
      `${t.padEnd(40)}| ${String(d).padStart(7)} | ${String(p).padStart(7)} | ${
        diff === 0 ? "  =" : (diff > 0 ? "+" : "") + diff
      }`
    );
  }
  console.log(`\nTables differing: ${totalDiff} of ${order.length}`);

  if (!CONFIRM) {
    console.log(
      "\nDry run complete. No changes written. Re-run with --confirm to mirror Dev → Prod."
    );
    await dev.end();
    await prod.end();
    return;
  }

  // ---- WRITE PHASE ----
  const client = await prod.connect();
  try {
    await client.query("BEGIN");

    // Truncate child tables first (reverse topological order). CASCADE handles
    // any FKs we might have missed.
    for (const t of [...order].reverse()) {
      await client.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`);
    }

    // Insert parents-first
    for (const t of order) {
      const cols = await getColumns(dev, t);
      if (cols.length === 0) continue;
      const colList = cols.map((c) => `"${c.name}"`).join(",");

      const rowsRes = await dev.query(`SELECT ${colList} FROM "${t}"`);
      const rows = rowsRes.rows;
      if (rows.length === 0) {
        console.log(`· ${t}: 0 rows`);
        continue;
      }

      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const params: unknown[] = [];
        const tuples: string[] = [];
        let p = 1;
        for (const r of chunk) {
          const placeholders: string[] = [];
          for (const c of cols) {
            placeholders.push(`$${p++}`);
            params.push(bindValue(r[c.name], c.dataType));
          }
          tuples.push(`(${placeholders.join(",")})`);
        }
        const sql = `INSERT INTO "${t}" (${colList}) VALUES ${tuples.join(",")}`;
        await client.query(sql, params);
      }
      console.log(`✓ ${t}: ${rows.length} rows mirrored`);
    }

    // Reset sequences for any serial columns
    const seqRes = await client.query<{
      seq: string;
      table_name: string;
      column_name: string;
    }>(`
      SELECT
        pg_get_serial_sequence('public.' || quote_ident(c.table_name), c.column_name) AS seq,
        c.table_name,
        c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND pg_get_serial_sequence('public.' || quote_ident(c.table_name), c.column_name) IS NOT NULL
    `);
    for (const s of seqRes.rows) {
      // Use the 3-arg form so empty tables get is_called=false (next nextval=1)
      // and populated tables get is_called=true (next nextval=max+1).
      await client.query(
        `SELECT setval(
           $1,
           COALESCE((SELECT MAX("${s.column_name}") FROM "${s.table_name}"), 1),
           (SELECT COUNT(*) > 0 FROM "${s.table_name}")
         )`,
        [s.seq]
      );
    }

    await client.query("COMMIT");
    console.log("\n✓ Sync committed.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\n✗ Sync rolled back.");
    throw e;
  } finally {
    client.release();
  }

  // AFTER snapshot
  console.log("\n--- Row counts AFTER ---");
  console.log(
    `${"TABLE".padEnd(40)}| ${"DEV".padStart(7)} | ${"PROD".padStart(7)} | OK?`
  );
  console.log("-".repeat(75));
  let allMatch = true;
  for (const t of order) {
    const d = await countRows(dev, t);
    const p = await countRows(prod, t);
    const ok = d === p;
    if (!ok) allMatch = false;
    console.log(
      `${t.padEnd(40)}| ${String(d).padStart(7)} | ${String(p).padStart(
        7
      )} | ${ok ? "✓" : "✗"}`
    );
  }
  console.log(
    allMatch
      ? "\n✓ All tables match. Dev and Prod are now in sync."
      : "\n✗ Some tables still differ — investigate."
  );

  await dev.end();
  await prod.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

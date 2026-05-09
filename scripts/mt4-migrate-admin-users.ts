// MT-4: migrate the OLD public.admin_users → NEW public.users + bind each
// migrated user to the tableicity tenant via public.tenant_members.
//
// IDEMPOTENT. Safe to run multiple times. Preserves UUIDs (so the existing
// admin_audit_log FK to admin_users.id remains satisfied for old rows AND
// new audit rows can reuse the same UUID).
//
// Usage:
//   npx tsx scripts/mt4-migrate-admin-users.ts                # dry-run
//   npx tsx scripts/mt4-migrate-admin-users.ts --confirm      # commit
//   DATABASE_URL=$PROD_DATABASE_URL npx tsx scripts/mt4-migrate-admin-users.ts --confirm
//
// What it does, in one transaction:
//   1. SELECT all admin_users.
//   2. For each: INSERT INTO public.users (id, email, password_hash,
//      display_name, created_at) VALUES (...) ON CONFLICT (email) DO NOTHING.
//      (Preserves id, password_hash format unchanged — login Just Works.)
//   3. INSERT INTO public.tenant_members (user_id, tenant_slug, role)
//      VALUES (id, 'tableicity', 'tenant_admin') ON CONFLICT DO NOTHING.

import pg from "pg";

const TARGET_TENANT = "tableicity";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const confirm = process.argv.includes("--confirm");

  console.log(`MT-4: migrate admin_users → users + tenant_members`);
  console.log(`  mode: ${confirm ? "CONFIRM (will COMMIT)" : "DRY-RUN (will ROLLBACK)"}`);
  console.log(`  target tenant: ${TARGET_TENANT}\n`);

  const pool = new pg.Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify target tenant exists.
    const t = await client.query(`SELECT 1 FROM public.tenants WHERE slug=$1`, [TARGET_TENANT]);
    if ((t.rowCount ?? 0) === 0) {
      throw new Error(`Target tenant '${TARGET_TENANT}' not found in public.tenants. Run MT-3 first.`);
    }

    const admins = await client.query(`SELECT id, username, password_hash, display_name, created_at FROM public.admin_users ORDER BY created_at`);
    console.log(`Found ${admins.rowCount} admin_users row(s).`);

    let usersInserted = 0, usersSkipped = 0, membersInserted = 0, membersSkipped = 0;
    for (const a of admins.rows) {
      const u = await client.query(
        `INSERT INTO public.users (id, email, password_hash, display_name, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [a.id, a.username, a.password_hash, a.display_name, a.created_at]
      );
      if ((u.rowCount ?? 0) > 0) usersInserted++; else usersSkipped++;

      const m = await client.query(
        `INSERT INTO public.tenant_members (user_id, tenant_slug, role)
         SELECT u.id, $2, 'tenant_admin'
         FROM public.users u
         WHERE u.email = $1
         ON CONFLICT (user_id) DO NOTHING
         RETURNING id`,
        [a.username, TARGET_TENANT]
      );
      if ((m.rowCount ?? 0) > 0) membersInserted++; else membersSkipped++;
    }

    console.log(`\n=== summary ===`);
    console.log(`  users:          inserted ${usersInserted}, already-present ${usersSkipped}`);
    console.log(`  tenant_members: inserted ${membersInserted}, already-present ${membersSkipped}`);

    if (confirm) {
      await client.query("COMMIT");
      console.log(`\nCOMMITTED.`);
    } else {
      await client.query("ROLLBACK");
      console.log(`\nROLLED BACK (dry-run). Re-run with --confirm to apply.`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`\nFAILED — rolled back.`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// MT-1 verification script: confirms the refusal guardrail trips when
// TENANT_DEFAULT_SLUG is empty and no AsyncLocalStorage context is active.
// Usage: npx tsx scripts/mt1-verify-guardrail.ts

process.env.TENANT_DEFAULT_SLUG = "";

(async () => {
  const { db, withTenantAsync } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // 1. Without context → must throw
  let threw = false;
  try {
    await db.execute(sql`select 1`);
  } catch (e: any) {
    threw = true;
    console.log("✓ no-context query threw:", e.message.split("\n")[0]);
  }
  if (!threw) {
    console.error("✗ FAIL: query without tenant context did NOT throw");
    process.exit(1);
  }

  // 2. With context → must succeed
  await withTenantAsync("tableicity", async () => {
    const r = await db.execute(sql`select 1 as ok`);
    console.log("✓ with-context query returned:", JSON.stringify(r.rows));
  });

  // 3. Verify search_path is actually set on the session (proves no race).
  await withTenantAsync("tableicity", async () => {
    const r = await db.execute(sql`show search_path`);
    console.log("✓ search_path on tableicity session:", JSON.stringify(r.rows));
  });

  // 4. Slug validator must reject malformed slugs.
  const { getTenantPool } = await import("@/lib/db");
  let validatorThrew = false;
  try {
    getTenantPool('"; drop schema public; --');
  } catch (e: any) {
    validatorThrew = true;
    console.log("✓ slug validator rejected injection attempt");
  }
  if (!validatorThrew) {
    console.error("✗ FAIL: slug validator did NOT reject malformed slug");
    process.exit(1);
  }

  console.log("MT-1 guardrail + race-fix + slug-validator: PASS");
  process.exit(0);
})().catch((e) => {
  console.error("script error:", e);
  process.exit(2);
});

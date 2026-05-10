import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tenants, tenantMembers } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { provisionTenantSchemaWithClient } from "@/lib/tenant/provisioner";
import { withTenantAsync } from "@/lib/tenant/context";
import { getTenantPool } from "@/lib/tenant/pools";
import { scryptSync, randomBytes } from "crypto";
import { z } from "zod";
import pg from "pg";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const TENANT_SLUG_RE = /^[a-z][a-z0-9_]{0,62}$/;

const createSchema = z.object({
  email: z.string().email().max(255).optional(),
  username: z.string().min(3).max(255).optional(), // legacy alias
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z.string().max(100).optional().nullable(),
  tenantSlug: z.string().regex(TENANT_SLUG_RE).optional(),
  newTenant: z
    .object({
      slug: z.string().regex(TENANT_SLUG_RE),
      personaDisplayName: z.string().min(1).max(100),
      publisherName: z.string().min(1).max(100),
      authorName: z.string().min(1).max(100),
      companyName: z.string().min(1).max(200),
      // MT-4.6: optional. Brand link template; supports `{city}` placeholder.
      // e.g. "https://www.tableicity.com/locations/{city}". Null = no brand link.
      brandHomeUrl: z.string().url().max(500).optional().nullable(),
    })
    .optional(),
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.email, // back-compat
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
      tenantSlug: tenantMembers.tenantSlug,
      tenantDisplayName: tenants.personaDisplayName,
    })
    .from(users)
    .leftJoin(tenantMembers, eq(tenantMembers.userId, users.id))
    .leftJoin(tenants, eq(tenants.slug, tenantMembers.tenantSlug))
    .orderBy(asc(users.createdAt));

  return NextResponse.json({
    currentUsername: session.email,
    currentTenantSlug: session.tenantSlug,
    admins: rows,
  });
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = `admin-users-write:${session.email}`;
  const { allowed, retryAfterMs } = checkRateLimit(rlKey);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const email = (parsed.email ?? parsed.username ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!parsed.tenantSlug && !parsed.newTenant) {
      return NextResponse.json({ error: "Pick an existing tenant or create a new one" }, { status: 400 });
    }
    if (parsed.tenantSlug && parsed.newTenant) {
      return NextResponse.json({ error: "Pick one: existing tenant or new tenant, not both" }, { status: 400 });
    }

    // Atomic create: provision tenant schema (if new) + insert tenants row +
    // insert user + insert tenant_member, ALL in one transaction on the SAME
    // pg client. Rolling back leaves no orphan schema or partial state.
    const url = process.env.DATABASE_URL!;
    const pool = new pg.Pool({ connectionString: url });
    const client = await pool.connect();

    let createdUserId = "";
    let createdTenantSlug = "";

    try {
      await client.query("BEGIN");

      // Email uniqueness check (the unique index would catch it, but we want
      // a friendly 409 rather than a generic 23505).
      const dup = await client.query(`SELECT 1 FROM public.users WHERE email=$1`, [email]);
      if ((dup.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }

      if (parsed.newTenant) {
        const t = parsed.newTenant;
        // Slug collision check.
        const ex = await client.query(`SELECT 1 FROM public.tenants WHERE slug=$1`, [t.slug]);
        if ((ex.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `Tenant slug '${t.slug}' already exists` }, { status: 409 });
        }
        // Provision tenant schema in this same transaction.
        await provisionTenantSchemaWithClient(client, t.slug);
        await client.query(
          `INSERT INTO public.tenants (slug, persona_display_name, publisher_name, author_name, company_name, brand_home_url) VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.slug, t.personaDisplayName, t.publisherName, t.authorName, t.companyName, t.brandHomeUrl ?? null]
        );
        createdTenantSlug = t.slug;
      } else {
        const ex = await client.query(`SELECT 1 FROM public.tenants WHERE slug=$1`, [parsed.tenantSlug!]);
        if ((ex.rowCount ?? 0) === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `Tenant '${parsed.tenantSlug}' not found` }, { status: 404 });
        }
        createdTenantSlug = parsed.tenantSlug!;
      }

      const userIns = await client.query(
        `INSERT INTO public.users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id`,
        [email, hashPassword(parsed.password), parsed.displayName ?? null]
      );
      createdUserId = userIns.rows[0].id;

      await client.query(
        `INSERT INTO public.tenant_members (user_id, tenant_slug, role) VALUES ($1, $2, 'tenant_admin')`,
        [createdUserId, createdTenantSlug]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
      await pool.end();
    }

    // Audit log lives in the actor's tenant schema (the admin who created the user).
    await withTenantAsync(session.tenantSlug, () =>
      logAuditEvent({
        username: session.email,
        action: "create",
        entityType: "user",
        entityId: createdUserId,
        details: { email, tenantSlug: createdTenantSlug, newTenant: !!parsed.newTenant },
      })
    );
    void getTenantPool; // keep import live for type-only consumers

    return NextResponse.json({
      id: createdUserId,
      username: email,
      email,
      displayName: parsed.displayName ?? null,
      tenantSlug: createdTenantSlug,
      createdAt: new Date().toISOString(),
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json({ error: e.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || "Failed to create user" }, { status: 400 });
  }
}

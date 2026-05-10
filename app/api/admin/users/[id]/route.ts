import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tenants, tenantMembers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { withTenantAsync } from "@/lib/tenant/context";
import { invalidateTenantBranding } from "@/lib/tenant/branding";
import { scryptSync, randomBytes } from "crypto";
import { z } from "zod";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const tenantPatchSchema = z
  .object({
    personaDisplayName: z.string().min(1).max(100).optional(),
    publisherName: z.string().min(1).max(100).optional(),
    authorName: z.string().min(1).max(100).optional(),
    companyName: z.string().min(1).max(200).optional(),
    brandHomeUrl: z
      .string()
      .max(500)
      .url("Brand home URL must be a valid URL")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .strict();

const patchSchema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters").optional(),
  displayName: z.string().max(100).nullable().optional(),
  tenant: tenantPatchSchema.optional(),
});

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlKey = `admin-users-write:${session.email}`;
  const { allowed, retryAfterMs } = checkRateLimit(rlKey);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const { id } = await params;
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.email === session.email) {
      return NextResponse.json(
        { error: "You cannot delete your own account while logged in." },
        { status: 400 },
      );
    }

    let removed = false;
    let lastUser = false;
    await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`SELECT id FROM public.users FOR UPDATE`);
      const total = (locked as any).rowCount ?? (locked as any).rows?.length ?? 0;
      if (total <= 1) { lastUser = true; return; }
      const result = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      removed = result.length > 0;
    });

    if (lastUser) return NextResponse.json({ error: "Cannot delete the last remaining user." }, { status: 400 });
    if (!removed) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await withTenantAsync(session.tenantSlug, () =>
      logAuditEvent({
        username: session.email,
        action: "delete",
        entityType: "user",
        entityId: id,
        details: { email: target.email },
      })
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete user" }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlKey = `admin-users-write:${session.email}`;
  const { allowed, retryAfterMs } = checkRateLimit(rlKey);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.parse(body);

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [member] = await db
      .select({ tenantSlug: tenantMembers.tenantSlug })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, id))
      .limit(1);

    const updatedFields: string[] = [];

    if (parsed.password) {
      await db.update(users).set({ passwordHash: hashPassword(parsed.password) }).where(eq(users.id, id));
      updatedFields.push("password");
    }

    if (parsed.displayName !== undefined) {
      await db.update(users).set({ displayName: parsed.displayName }).where(eq(users.id, id));
      updatedFields.push("displayName");
    }

    if (parsed.tenant && Object.keys(parsed.tenant).length > 0) {
      if (!member) {
        return NextResponse.json(
          { error: "User has no tenant binding; cannot update tenant fields." },
          { status: 400 },
        );
      }
      const tenantUpdate: Record<string, any> = {};
      if (parsed.tenant.personaDisplayName !== undefined) tenantUpdate.personaDisplayName = parsed.tenant.personaDisplayName;
      if (parsed.tenant.publisherName !== undefined) tenantUpdate.publisherName = parsed.tenant.publisherName;
      if (parsed.tenant.authorName !== undefined) tenantUpdate.authorName = parsed.tenant.authorName;
      if (parsed.tenant.companyName !== undefined) tenantUpdate.companyName = parsed.tenant.companyName;
      if (parsed.tenant.brandHomeUrl !== undefined) tenantUpdate.brandHomeUrl = parsed.tenant.brandHomeUrl;

      if (Object.keys(tenantUpdate).length > 0) {
        await db.update(tenants).set(tenantUpdate).where(eq(tenants.slug, member.tenantSlug));
        invalidateTenantBranding(member.tenantSlug);
        updatedFields.push(...Object.keys(tenantUpdate).map((k) => `tenant.${k}`));
      }
    }

    if (updatedFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await withTenantAsync(session.tenantSlug, () =>
      logAuditEvent({
        username: session.email,
        action: "update",
        entityType: "user",
        entityId: id,
        details: { email: target.email, fields: updatedFields, tenantSlug: member?.tenantSlug ?? null },
      })
    );

    return NextResponse.json({ success: true, updated: updatedFields });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json({ error: e.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || "Failed to update user" }, { status: 400 });
  }
}

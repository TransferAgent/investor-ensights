import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { db } from "@/lib/db";
import { adminUsers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { scryptSync, randomBytes } from "crypto";
import { z } from "zod";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const patchSchema = z.object({
  password: z.string().min(12, "Password must be at least 12 characters").optional(),
});

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = `admin-users-write:${session.username}`;
  const { allowed, retryAfterMs } = checkRateLimit(rlKey);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  try {
    const { id } = await params;
    const target = await storage.getAdminById(id);
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }
    if (target.username === session.username) {
      return NextResponse.json(
        { error: "You cannot delete your own account while logged in." },
        { status: 400 },
      );
    }

    let removed = false;
    let lastAdmin = false;
    await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT id FROM admin_users FOR UPDATE`,
      );
      const total = (locked as any).rowCount ?? (locked as any).rows?.length ?? 0;
      if (total <= 1) {
        lastAdmin = true;
        return;
      }
      const result = await tx
        .delete(adminUsers)
        .where(eq(adminUsers.id, id))
        .returning({ id: adminUsers.id });
      removed = result.length > 0;
    });

    if (lastAdmin) {
      return NextResponse.json(
        { error: "Cannot delete the last remaining admin." },
        { status: 400 },
      );
    }
    if (!removed) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    await logAuditEvent({
      username: session.username,
      action: "delete",
      entityType: "admin_user",
      entityId: id,
      details: { username: target.username },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete admin" }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlKey = `admin-users-write:${session.username}`;
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

    const target = await storage.getAdminById(id);
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    if (parsed.password) {
      await storage.updateAdminPassword(id, hashPassword(parsed.password));
      await logAuditEvent({
        username: session.username,
        action: "update",
        entityType: "admin_user",
        entityId: id,
        details: { field: "password", username: target.username },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json({ error: e.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || "Failed to update admin" }, { status: 400 });
  }
}

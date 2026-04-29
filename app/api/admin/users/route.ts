import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
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

const createSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z.string().max(100).optional().nullable(),
});

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admins = await storage.listAdmins();
  return NextResponse.json({
    currentUsername: session.username,
    admins,
  });
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const parsed = createSchema.parse(body);

    const existing = await storage.getAdminByUsername(parsed.username);
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const created = await storage.createAdmin({
      username: parsed.username,
      passwordHash: hashPassword(parsed.password),
      displayName: parsed.displayName ?? null,
    });

    await logAuditEvent({
      username: session.username,
      action: "create",
      entityType: "admin_user",
      entityId: created.id,
      details: { username: created.username },
    });

    return NextResponse.json({
      id: created.id,
      username: created.username,
      displayName: created.displayName,
      createdAt: created.createdAt,
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json({ error: e.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message || "Failed to create admin" }, { status: 400 });
  }
}

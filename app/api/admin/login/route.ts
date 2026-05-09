import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tenantMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { scryptSync, timingSafeEqual } from "crypto";
import { withTenantAsync } from "@/lib/tenant/context";
import { z } from "zod";

const loginSchema = z.object({
  // Backwards-compatible: existing UI sends `username`. New email-based auth
  // accepts either field name.
  email: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const { email, username, password } = loginSchema.parse(body);
    const loginId = (email ?? username ?? "").trim().toLowerCase();
    if (!loginId) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Auth lookups hit public.* tables — fine under any tenant search_path
    // since public is always second in the search_path. No tenant context
    // needed yet (we don't know the user's tenant until we find them).
    const [user] = await db.select().from(users).where(eq(users.email, loginId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const [salt, hash] = user.passwordHash.split(":");
    const testHash = scryptSync(password, salt, 64).toString("hex");
    const isValid = timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const [member] = await db.select().from(tenantMembers).where(eq(tenantMembers.userId, user.id)).limit(1);
    if (!member) {
      return NextResponse.json(
        { error: "Account is not bound to any tenant. Contact your administrator." },
        { status: 403 }
      );
    }

    await createSession({ userId: user.id, email: user.email, tenantSlug: member.tenantSlug });

    // Audit log lives in the per-tenant schema, so wrap the write in tenant context.
    await withTenantAsync(member.tenantSlug, () =>
      logAuditEvent({ username: user.email, action: "login", entityType: "session" })
    );
    resetRateLimit(ip);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.email,
        email: user.email,
        displayName: user.displayName,
        tenantSlug: member.tenantSlug,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

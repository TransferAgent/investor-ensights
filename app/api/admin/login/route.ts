import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@shared/schema";
import { scryptSync, timingSafeEqual } from "crypto";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

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
    const { username, password } = loginSchema.parse(body);

    const admin = await storage.getAdminByUsername(username);
    if (!admin) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const [salt, hash] = admin.passwordHash.split(":");
    const testHash = scryptSync(password, salt, 64).toString("hex");
    const isValid = timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));

    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createSession(admin.id as unknown as number, admin.username);
    await logAuditEvent({ username, action: "login", entityType: "session" });
    resetRateLimit(ip);

    return NextResponse.json({
      success: true,
      user: { id: admin.id, username: admin.username, displayName: admin.displayName },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

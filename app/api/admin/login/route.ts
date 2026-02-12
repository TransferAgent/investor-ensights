import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@shared/schema";
import { scryptSync, timingSafeEqual } from "crypto";

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      user: { id: admin.id, username: admin.username, displayName: admin.displayName },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

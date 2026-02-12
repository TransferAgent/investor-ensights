import { NextResponse } from "next/server";
import { destroySession, verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST() {
  const session = await verifySession();
  if (session) {
    await logAuditEvent({ username: session.username, action: "logout", entityType: "session" });
  }
  await destroySession();
  return NextResponse.json({ success: true });
}

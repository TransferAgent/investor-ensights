import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await storage.getAdminById(String(session.adminId));
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
  });
}

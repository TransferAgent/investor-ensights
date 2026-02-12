import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const city = await storage.updateCity(id, body);
    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }
    await logAuditEvent({ username: session.username, action: "update", entityType: "city", entityId: id, details: body });
    return NextResponse.json(city);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update city" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await storage.deleteCity(id);
    await logAuditEvent({ username: session.username, action: "delete", entityType: "city", entityId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to delete city" }, { status: 400 });
  }
}

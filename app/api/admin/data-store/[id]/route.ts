import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

const VALID_STATUSES = ["pending", "approved", "rejected"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status. Must be: pending, approved, or rejected" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) updates.notes = body.notes;

  const updated = await storage.updateDataStoreFile(id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({ username: session.username, action: "update", entityType: "data_store_file", entityId: id });
  const { fileData: _, ...result } = updated;
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await storage.deleteDataStoreFile(id);
  await logAuditEvent({ username: session.username, action: "delete", entityType: "data_store_file", entityId: id });
  return NextResponse.json({ success: true });
}

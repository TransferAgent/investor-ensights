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
    const template = await storage.updateTemplate(id, body);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await logAuditEvent({ username: session.username, action: "update", entityType: "template", entityId: id, details: body });
    return NextResponse.json(template);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update template" }, { status: 400 });
  }
}

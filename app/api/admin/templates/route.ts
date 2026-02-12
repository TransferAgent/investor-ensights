import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await storage.getTemplates(false);
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const template = await storage.createTemplate(body);
    await logAuditEvent({ username: session.username, action: "create", entityType: "template", entityId: template.id, details: { templateName: template.templateName } });
    return NextResponse.json(template, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create template" }, { status: 400 });
  }
}

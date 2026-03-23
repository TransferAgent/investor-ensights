import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await storage.getKnowledgeTemplates();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const template = await storage.createKnowledgeTemplate(body);
  await logAuditEvent({ username: session.username, action: "create", entityType: "knowledge_template", entityId: template.id });
  return NextResponse.json(template, { status: 201 });
}

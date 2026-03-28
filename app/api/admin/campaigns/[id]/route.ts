import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await storage.getCampaignById(id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const campaign = await storage.updateCampaign(id, body);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({
    username: session.username,
    action: "update",
    entityType: "knowledge_campaign",
    entityId: id,
  });

  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await storage.deleteCampaign(id);

  await logAuditEvent({
    username: session.username,
    action: "delete",
    entityType: "knowledge_campaign",
    entityId: id,
  });

  return NextResponse.json({ success: true });
}

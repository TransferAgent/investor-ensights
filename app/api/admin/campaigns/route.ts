import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await storage.getCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, templateId } = body;

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");

  const campaign = await storage.createCampaign({
    name,
    slug,
    description: description || null,
    templateId: templateId || null,
    status: "active",
    articleCount: 0,
  });

  await logAuditEvent({
    username: session.username,
    action: "create",
    entityType: "knowledge_campaign",
    entityId: campaign.id,
  });

  return NextResponse.json(campaign, { status: 201 });
}

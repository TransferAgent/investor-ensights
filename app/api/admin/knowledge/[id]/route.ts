import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { sanitizeNewsroomHtml } from "@/lib/newsroom/htmlSanitizer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await storage.getKnowledgeArticleById(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: any = {};

  if (body.title !== undefined) data.title = sanitizeString(body.title);
  if (body.headline !== undefined) data.headline = body.headline;
  if (body.subheadline !== undefined) data.subheadline = body.subheadline || null;
  if (body.dateline !== undefined) data.dateline = body.dateline ? sanitizeString(body.dateline) : null;
  if (body.metaDescription !== undefined) data.metaDescription = body.metaDescription ? sanitizeString(body.metaDescription) : null;
  if (body.bodyHtml !== undefined) data.bodyHtml = sanitizeNewsroomHtml(body.bodyHtml);
  if (body.boilerplateHtml !== undefined) data.boilerplateHtml = body.boilerplateHtml || null;
  if (body.ogImageUrl !== undefined) data.ogImageUrl = body.ogImageUrl || null;
  if (body.authorName !== undefined) data.authorName = body.authorName;
  if (body.publisherName !== undefined) data.publisherName = body.publisherName;
  if (body.robots !== undefined) data.robots = body.robots;
  if (body.slug !== undefined) {
    data.slug = sanitizeString(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl || null;
  if (body.campaignId !== undefined) data.campaignId = body.campaignId || null;

  const updated = await storage.updateKnowledgeArticle(id, data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({ username: session.username, action: "update", entityType: "knowledge_article", entityId: id });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await storage.deleteKnowledgeArticle(id);
  await logAuditEvent({ username: session.username, action: "delete", entityType: "knowledge_article", entityId: id });
  return NextResponse.json({ success: true });
}

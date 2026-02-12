import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const page = await storage.getPageById(id);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const slides = await storage.getSlidesByPageId(id);
  return NextResponse.json({ ...page, slides });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const updateData: Record<string, any> = {};

  if (body.pageTitle !== undefined) updateData.pageTitle = sanitizeString(body.pageTitle);
  if (body.slug !== undefined) updateData.slug = sanitizeString(body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  if (body.metaTitle !== undefined) updateData.metaTitle = body.metaTitle ? sanitizeString(body.metaTitle) : null;
  if (body.metaDescription !== undefined) updateData.metaDescription = body.metaDescription ? sanitizeString(body.metaDescription) : null;
  if (body.ogImageUrl !== undefined) updateData.ogImageUrl = body.ogImageUrl || null;
  if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
  if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

  const page = await storage.updatePage(id, updateData);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  await logAuditEvent({ username: session.username, action: "update", entityType: "page", entityId: id });
  return NextResponse.json(page);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await storage.deletePage(id);
  await logAuditEvent({ username: session.username, action: "delete", entityType: "page", entityId: id });
  return NextResponse.json({ success: true });
}

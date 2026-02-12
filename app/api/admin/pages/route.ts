import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pages = await storage.getPages();
  return NextResponse.json(pages);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const slug = sanitizeString((body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    const pageTitle = sanitizeString((body.pageTitle || "").trim());

    if (!slug || !pageTitle) {
      return NextResponse.json({ error: "Slug and page title are required" }, { status: 400 });
    }

    const existing = await storage.getPageBySlug(slug);
    if (existing) {
      return NextResponse.json({ error: "A page with this slug already exists" }, { status: 409 });
    }

    const page = await storage.createPage({
      slug,
      pageTitle,
      metaTitle: body.metaTitle ? sanitizeString(body.metaTitle) : null,
      metaDescription: body.metaDescription ? sanitizeString(body.metaDescription) : null,
      ogImageUrl: body.ogImageUrl || null,
      isPublished: body.isPublished || false,
      displayOrder: body.displayOrder || 0,
      createdBy: session.username,
    });

    await logAuditEvent({ username: session.username, action: "create", entityType: "page", entityId: page.id });
    return NextResponse.json(page, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create page" }, { status: 400 });
  }
}

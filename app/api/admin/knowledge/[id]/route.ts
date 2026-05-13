import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { sanitizeNewsroomHtml } from "@/lib/newsroom/htmlSanitizer";
import { withTenantAsync } from "@/lib/tenant/context";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return withTenantAsync(session.tenantSlug, async () => {
    const article = await storage.getKnowledgeArticleById(id);
    if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(article);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  return withTenantAsync(session.tenantSlug, () => handlePatch(id, body, session.username));
}

async function handlePatch(id: string, body: any, username: string) {
  const data: any = {};

  if (body.title !== undefined) data.title = sanitizeString(body.title);
  if (body.headline !== undefined) data.headline = body.headline;
  if (body.subheadline !== undefined) data.subheadline = body.subheadline || null;
  if (body.dateline !== undefined) data.dateline = body.dateline ? sanitizeString(body.dateline) : null;

  // MT-4.12: meta_title + meta_description are version-locked once published.
  // Refuse to mutate either when meta_locked_at is set; otherwise stamp
  // provenance as 'manual' and bump meta_generated_at on any meta change.
  const wantsMetaTitle = body.metaTitle !== undefined;
  const wantsMetaDesc = body.metaDescription !== undefined;
  if (wantsMetaTitle || wantsMetaDesc) {
    const current = await storage.getKnowledgeArticleById(id);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (current.metaLockedAt) {
      return NextResponse.json(
        { error: "Meta title/description are locked for this article and cannot be edited." },
        { status: 409 }
      );
    }
    if (wantsMetaTitle) data.metaTitle = body.metaTitle ? sanitizeString(body.metaTitle) : null;
    if (wantsMetaDesc) data.metaDescription = body.metaDescription ? sanitizeString(body.metaDescription) : null;
    data.metaSource = "manual";
    data.metaGeneratedAt = new Date();
  }

  if (body.bodyHtml !== undefined) data.bodyHtml = sanitizeNewsroomHtml(body.bodyHtml);
  if (body.boilerplateHtml !== undefined) data.boilerplateHtml = body.boilerplateHtml || null;
  if (body.ogImageUrl !== undefined) data.ogImageUrl = body.ogImageUrl || null;
  if (body.authorName !== undefined) data.authorName = body.authorName;
  if (body.publisherName !== undefined) data.publisherName = body.publisherName;
  if (body.robots !== undefined) {
    const wantsIndex = !String(body.robots || "").toLowerCase().includes("noindex");
    if (wantsIndex) {
      const current = await storage.getKnowledgeArticleById(id);
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (current.status !== "published") {
        return NextResponse.json(
          { error: "Cannot set robots to Index on a non-published article. Publish the article first, then flip Index." },
          { status: 409 }
        );
      }
    }
    data.robots = body.robots;
  }
  if (body.slug !== undefined) {
    data.slug = sanitizeString(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  if (body.canonicalUrl !== undefined) data.canonicalUrl = body.canonicalUrl || null;
  if (body.campaignId !== undefined) data.campaignId = body.campaignId || null;
  if (body.googleIndexed !== undefined) data.googleIndexed = !!body.googleIndexed;

  const updated = await storage.updateKnowledgeArticle(id, data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({ username: username, action: "update", entityType: "knowledge_article", entityId: id });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  return withTenantAsync(session.tenantSlug, async () => {
    await storage.deleteKnowledgeArticle(id);
    await logAuditEvent({ username: session.username, action: "delete", entityType: "knowledge_article", entityId: id });
    return NextResponse.json({ success: true });
  });
}

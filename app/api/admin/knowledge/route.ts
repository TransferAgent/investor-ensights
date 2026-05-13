import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { sanitizeNewsroomHtml } from "@/lib/newsroom/htmlSanitizer";
import { withTenantAsync } from "@/lib/tenant/context";
import { resolveBrandContext } from "@/lib/newsroom/brandContext";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  return withTenantAsync(session.tenantSlug, async () => {
    const articles = await storage.getKnowledgeArticles(status);
    return NextResponse.json(articles);
  });
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const slug = sanitizeString(body.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

  return withTenantAsync(session.tenantSlug, async () => {
    const existing = await storage.getKnowledgeArticleBySlug(slug);
    if (existing) return NextResponse.json({ error: "An article with this slug already exists" }, { status: 409 });

    // MT-4.12: brand-resolved fallback for author/publisher; if any meta_*
    // field is supplied on create, stamp provenance as 'manual'.
    const brand = await resolveBrandContext(session.tenantSlug);
    const metaTitle = body.metaTitle ? sanitizeString(body.metaTitle) : null;
    const metaDescription = body.metaDescription ? sanitizeString(body.metaDescription) : null;
    const hasManualMeta = !!(metaTitle || metaDescription);

    const article = await storage.createKnowledgeArticle({
      slug,
      title: sanitizeString(body.title || body.headline || "Untitled"),
      headline: body.headline || body.title || "Untitled",
      subheadline: body.subheadline || null,
      dateline: body.dateline ? sanitizeString(body.dateline) : null,
      metaTitle,
      metaDescription,
      metaSource: hasManualMeta ? "manual" : null,
      metaGeneratedAt: hasManualMeta ? new Date() : null,
      bodyHtml: sanitizeNewsroomHtml(body.bodyHtml || "<p></p>"),
      boilerplateHtml: body.boilerplateHtml || null,
      ogImageUrl: body.ogImageUrl || null,
      authorName: body.authorName || brand.authorName,
      publisherName: body.publisherName || brand.publisherName,
    });

    await logAuditEvent({ username: session.username, action: "create", entityType: "knowledge_article", entityId: article.id });
    return NextResponse.json(article, { status: 201 });
  });
}

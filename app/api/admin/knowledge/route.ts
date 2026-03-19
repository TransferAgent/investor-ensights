import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const articles = await storage.getKnowledgeArticles(status);
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const slug = sanitizeString(body.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

  const existing = await storage.getKnowledgeArticleBySlug(slug);
  if (existing) return NextResponse.json({ error: "An article with this slug already exists" }, { status: 409 });

  const article = await storage.createKnowledgeArticle({
    slug,
    title: sanitizeString(body.title || body.headline || "Untitled"),
    headline: sanitizeString(body.headline || body.title || "Untitled"),
    subheadline: body.subheadline ? sanitizeString(body.subheadline) : null,
    dateline: body.dateline ? sanitizeString(body.dateline) : null,
    metaDescription: body.metaDescription ? sanitizeString(body.metaDescription) : null,
    bodyHtml: body.bodyHtml || "<p></p>",
    boilerplateHtml: body.boilerplateHtml || null,
    ogImageUrl: body.ogImageUrl || null,
    authorName: body.authorName || "Tableicity",
    publisherName: body.publisherName || "Tableicity",
  });

  await logAuditEvent({ username: session.username, action: "create", entityType: "knowledge_article", entityId: article.id });
  return NextResponse.json(article, { status: 201 });
}

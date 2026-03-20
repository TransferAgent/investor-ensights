import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { validateImageUrl } from "@/lib/image-validate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await storage.getKnowledgeArticleById(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!article.ogImageUrl) {
    return NextResponse.json({ error: "OG image must be set before publishing. Articles without an OG image are not eligible for Google Discover." }, { status: 400 });
  }

  const imageCheck = await validateImageUrl(article.ogImageUrl);
  if (!imageCheck.reachable) {
    return NextResponse.json({ error: `OG image URL is unreachable. Please verify the image is publicly accessible. ${imageCheck.error || ""}` }, { status: 400 });
  }

  const updated = await storage.publishKnowledgeArticle(id, session.username);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({ username: session.username, action: "publish", entityType: "knowledge_article", entityId: id });
  return NextResponse.json(updated);
}

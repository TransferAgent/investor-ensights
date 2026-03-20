import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await storage.getKnowledgeArticleById(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (article.status !== "published") {
    return NextResponse.json({ error: "Only published articles can be unpublished" }, { status: 400 });
  }

  const updated = await storage.unpublishKnowledgeArticle(id, session.username);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAuditEvent({ username: session.username, action: "unpublish", entityType: "knowledge_article", entityId: id });
  return NextResponse.json(updated);
}

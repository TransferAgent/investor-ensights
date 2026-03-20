import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { articleIds } = body;

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return NextResponse.json({ error: "articleIds array is required" }, { status: 400 });
  }

  const dedupedIds = [...new Set(articleIds.filter((id: any) => typeof id === "string" && id.length > 0))];

  if (dedupedIds.length > 100) {
    return NextResponse.json({ error: "Maximum 100 articles per batch" }, { status: 400 });
  }

  const results = { unpublished: 0, skipped: 0, notFound: 0, errors: [] as string[] };

  for (const id of dedupedIds) {
    if (typeof id !== "string") {
      results.skipped++;
      continue;
    }
    const article = await storage.getKnowledgeArticleById(id);
    if (!article) {
      results.notFound++;
      continue;
    }
    if (article.status !== "published") {
      results.skipped++;
      continue;
    }
    try {
      await storage.unpublishKnowledgeArticle(id, session.username);
      await logAuditEvent({ username: session.username, action: "unpublish", entityType: "knowledge_article", entityId: id });
      results.unpublished++;
    } catch (err: any) {
      results.errors.push(`${id}: ${err.message}`);
    }
  }

  return NextResponse.json(results);
}

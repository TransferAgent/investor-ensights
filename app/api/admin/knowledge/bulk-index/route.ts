import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const DEFAULT_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow";

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { articleIds, action } = await request.json();

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return NextResponse.json({ error: "articleIds required" }, { status: 400 });
  }
  if (action !== "index" && action !== "noindex") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  let applied = 0;
  let skipped = 0;

  for (const id of articleIds) {
    const article = await storage.getKnowledgeArticleById(id);
    if (!article) {
      skipped += 1;
      continue;
    }
    if (action === "index") {
      if (article.status !== "published") {
        skipped += 1;
        continue;
      }
      await storage.updateKnowledgeArticle(id, { robots: DEFAULT_ROBOTS });
      applied += 1;
    } else {
      await storage.updateKnowledgeArticle(id, { robots: NOINDEX_ROBOTS });
      applied += 1;
    }
  }

  await logAuditEvent({
    username: session.username,
    action: `bulk_${action}`,
    entityType: "knowledge_article",
    details: { articleIds, applied, skipped },
  });

  return NextResponse.json({ success: true, applied, skipped });
}

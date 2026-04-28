import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { hashHaylo, buildInsertFromPaste, ensureUniqueSlug } from "@/lib/haylo/ingest";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const topicSlug = searchParams.get("topic") ?? undefined;
  const articles = await storage.listHayloArticles({ status, topicSlug });
  return NextResponse.json(articles);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { title, topicSlug, bodyHtml, summary, status, slug } = body ?? {};

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!topicSlug || typeof topicSlug !== "string") {
      return NextResponse.json({ error: "topicSlug is required" }, { status: 400 });
    }
    if (!bodyHtml || typeof bodyHtml !== "string" || bodyHtml.trim().length === 0) {
      return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
    }

    const contentHash = hashHaylo(bodyHtml);
    const dupe = await storage.getHayloArticleByContentHash(contentHash);
    if (dupe) {
      return NextResponse.json(
        { error: "duplicate", message: `Identical content already exists as Haylo article "${dupe.title}"`, existingId: dupe.id },
        { status: 409 }
      );
    }

    const insert = buildInsertFromPaste({ title, topicSlug, bodyHtml, summary, status, slug, source: "paste" });
    insert.slug = await ensureUniqueSlug(insert.slug, async (s) => Boolean(await storage.getHayloArticleBySlug(s)));

    const created = await storage.createHayloArticle(insert, contentHash);

    await logAuditEvent({
      username: session.username,
      action: "haylo_article.create",
      entityType: "haylo_article",
      entityId: created.id,
      details: { title: created.title, topicSlug: created.topicSlug, source: "paste" },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to create Haylo article", message: e?.message ?? String(e) }, { status: 500 });
  }
}

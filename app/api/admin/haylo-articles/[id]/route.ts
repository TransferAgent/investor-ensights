import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { hashHaylo, ensureUniqueSlug, slugifyHaylo } from "@/lib/haylo/ingest";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await storage.getHayloArticleById(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await storage.getHayloArticleById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim().length > 0) update.title = body.title.trim();
    if (typeof body.topicSlug === "string" && body.topicSlug.trim().length > 0) update.topicSlug = slugifyHaylo(body.topicSlug, "general");
    if (typeof body.summary === "string" || body.summary === null) update.summary = body.summary;
    if (typeof body.status === "string" && ["draft", "ready", "retired"].includes(body.status)) update.status = body.status;
    if (typeof body.slug === "string" && body.slug.trim().length > 0) {
      const desired = slugifyHaylo(body.slug);
      if (desired !== existing.slug) {
        update.slug = await ensureUniqueSlug(desired, async (s) => Boolean(await storage.getHayloArticleBySlug(s)));
      }
    }
    if (typeof body.bodyHtml === "string" && body.bodyHtml.trim().length > 0 && body.bodyHtml !== existing.bodyHtml) {
      const newHash = hashHaylo(body.bodyHtml);
      const conflict = await storage.getHayloArticleByContentHash(newHash);
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: "duplicate", message: `New content matches existing Haylo article "${conflict.title}"`, existingId: conflict.id },
          { status: 409 }
        );
      }
      update.bodyHtml = body.bodyHtml;
      (update as any).contentHash = newHash;
    }

    const updated = await storage.updateHayloArticle(id, update as any);
    await logAuditEvent({
      username: session.username,
      action: "haylo_article.update",
      entityType: "haylo_article",
      entityId: id,
      details: { fields: Object.keys(update) },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to update", message: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await storage.getHayloArticleById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if ((existing.placementCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "in_use", message: `Cannot delete: this Haylo article has ${existing.placementCount} active placements. Retire it instead.` },
      { status: 409 }
    );
  }

  await storage.deleteHayloArticle(id);
  await logAuditEvent({
    username: session.username,
    action: "haylo_article.delete",
    entityType: "haylo_article",
    entityId: id,
    details: { title: existing.title, slug: existing.slug },
  });
  return NextResponse.json({ ok: true });
}

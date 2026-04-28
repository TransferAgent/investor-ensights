import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { hashHaylo, parseHayloFile, buildInsertFromPaste, ensureUniqueSlug } from "@/lib/haylo/ingest";

const INBOX_DIR = "haylo-inbox";

export async function POST(_request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dir = join(process.cwd(), INBOX_DIR);
  let entries: string[] = [];
  try {
    const all = await readdir(dir);
    entries = all.filter((f) => /\.html?$/i.test(f) && !f.startsWith("."));
  } catch (e: any) {
    return NextResponse.json(
      { error: "inbox_missing", message: `Inbox folder ${INBOX_DIR}/ not found at ${dir}`, detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }

  const imported: Array<{ filename: string; id: string; title: string; topicSlug: string }> = [];
  const skipped: Array<{ filename: string; reason: string; existingId?: string }> = [];
  const errors: Array<{ filename: string; message: string }> = [];

  for (const filename of entries) {
    try {
      const contents = await readFile(join(dir, filename), "utf-8");
      if (contents.trim().length === 0) {
        skipped.push({ filename, reason: "empty file" });
        continue;
      }
      const hash = hashHaylo(contents);
      const dupe = await storage.getHayloArticleByContentHash(hash);
      if (dupe) {
        skipped.push({ filename, reason: "duplicate content", existingId: dupe.id });
        continue;
      }
      const parsed = parseHayloFile(filename, contents);
      const insert = buildInsertFromPaste({
        title: parsed.title,
        topicSlug: parsed.topicSlug,
        bodyHtml: parsed.bodyHtml,
        summary: parsed.summary,
        status: "ready",
        source: "inbox-import",
        sourceFilename: filename,
      });
      insert.slug = await ensureUniqueSlug(insert.slug, async (s) => Boolean(await storage.getHayloArticleBySlug(s)));
      const created = await storage.createHayloArticle(insert, hash);
      imported.push({ filename, id: created.id, title: created.title, topicSlug: created.topicSlug });
    } catch (e: any) {
      errors.push({ filename, message: e?.message ?? String(e) });
    }
  }

  await logAuditEvent({
    username: session.username,
    action: "haylo_article.scan_inbox",
    entityType: "haylo_article",
    details: { totalSeen: entries.length, imported: imported.length, skipped: skipped.length, errors: errors.length },
  });

  return NextResponse.json({
    inboxPath: INBOX_DIR,
    totalSeen: entries.length,
    imported,
    skipped,
    errors,
  });
}

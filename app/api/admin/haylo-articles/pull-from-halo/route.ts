import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { hashHaylo, parseHaloPayload, buildInsertFromPaste, ensureUniqueSlug, slugifyHaylo } from "@/lib/haylo/ingest";

const HALO_BASE_URL = "https://haylords.com/api/public/published";
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety: max 5,000 items per pull
const RATE_LIMIT_BACKOFF_MS = 60_000;

interface PulledItem {
  id: number;
  publishedAt: string;
  htmlContent: string;
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let dryRun = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = !!body?.dryRun;
  } catch { /* no body is fine */ }

  // Read this tenant's Halo key + watermark.
  const [tenantRow] = await db
    .select({
      key: tenants.haloDistributionKey,
      lastPulledId: tenants.haloLastPulledId,
    })
    .from(tenants)
    .where(eq(tenants.slug, session.tenantSlug))
    .limit(1);

  if (!tenantRow) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const haloKey = tenantRow.key;
  if (!haloKey || haloKey.length === 0) {
    return NextResponse.json(
      {
        error: "halo_key_not_configured",
        message: "No Halo Lab API key set for this tenant. Configure it in Settings → Users & Tenants.",
      },
      { status: 400 },
    );
  }

  let cursor = tenantRow.lastPulledId ?? 0;
  let highestSeen = cursor;
  const imported: Array<{ remoteId: number; id: string; title: string; slug: string }> = [];
  const skipped: Array<{ remoteId: number; reason: string; existingId?: string }> = [];
  const errors: Array<{ remoteId?: number; message: string }> = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${HALO_BASE_URL}?since=${cursor}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${haloKey}` },
        cache: "no-store",
      });
    } catch (e: any) {
      errors.push({ message: `Network error calling Halo: ${e?.message ?? String(e)}` });
      break;
    }

    if (res.status === 401) {
      return NextResponse.json(
        {
          error: "halo_key_rejected",
          message: "Halo rejected the API key. Ask John to confirm or rotate, then update the key in Settings → Users & Tenants.",
        },
        { status: 401 },
      );
    }
    if (res.status === 429) {
      errors.push({ message: `Halo rate-limited the request after ${imported.length} imports. Try again in ${Math.ceil(RATE_LIMIT_BACKOFF_MS / 1000)}s.` });
      break;
    }
    if (!res.ok) {
      errors.push({ message: `Halo returned HTTP ${res.status} after ${imported.length} imports.` });
      break;
    }

    let items: PulledItem[];
    try {
      items = (await res.json()) as PulledItem[];
    } catch (e: any) {
      errors.push({ message: `Halo response was not valid JSON: ${e?.message ?? String(e)}` });
      break;
    }

    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      try {
        if (typeof item?.id !== "number" || typeof item?.htmlContent !== "string") {
          errors.push({ remoteId: item?.id, message: "Malformed item from Halo (missing id or htmlContent)." });
          continue;
        }
        if (item.id > highestSeen) highestSeen = item.id;

        // Layer 1: dedupe by Halo remote id.
        const byRemote = await storage.getHayloArticleByHaloRemoteId(item.id);
        if (byRemote) {
          skipped.push({ remoteId: item.id, reason: "already imported (remote id match)", existingId: byRemote.id });
          continue;
        }

        // Layer 2: dedupe by content hash (catches manually-pasted essays).
        const hash = hashHaylo(item.htmlContent);
        const byHash = await storage.getHayloArticleByContentHash(hash);
        if (byHash) {
          skipped.push({ remoteId: item.id, reason: "already imported (content hash match)", existingId: byHash.id });
          continue;
        }

        // Parse title + summary out of the htmlContent. Halo doesn't send a topic.
        const parsed = parseHaloPayload(item.htmlContent);
        const baseSlug = slugifyHaylo(parsed.title, `halo-${item.id}`);
        const insert = buildInsertFromPaste({
          title: parsed.title,
          topicSlug: "", // builder slugifies; we'll null it out below since topic is optional now
          bodyHtml: parsed.bodyHtml,
          summary: parsed.summary,
          status: "draft",
          source: "halo_api",
          sourceFilename: null,
          slug: baseSlug,
        });
        // Null out topic — admin assigns in the Library after import.
        (insert as any).topicSlug = null;
        // Attach Halo-specific fields.
        (insert as any).haloRemoteId = item.id;
        (insert as any).haloPublishedAt = new Date(item.publishedAt);

        if (dryRun) {
          imported.push({ remoteId: item.id, id: "(dry-run)", title: parsed.title, slug: baseSlug });
          continue;
        }

        insert.slug = await ensureUniqueSlug(baseSlug, async (s) => Boolean(await storage.getHayloArticleBySlug(s)));
        const created = await storage.createHayloArticle(insert, hash);
        imported.push({ remoteId: item.id, id: created.id, title: created.title, slug: created.slug });
      } catch (e: any) {
        errors.push({ remoteId: item?.id, message: e?.message ?? String(e) });
      }
    }

    // Advance the cursor to the highest id in this page.
    cursor = items[items.length - 1].id;

    // Persist the watermark per-page so an interrupted pull (rate-limit, 5xx,
    // network blip, page crash) doesn't force the next pull to re-scan
    // thousands of already-imported items. Skip on dry-run.
    if (!dryRun && highestSeen > (tenantRow.lastPulledId ?? 0)) {
      try {
        await db
          .update(tenants)
          .set({ haloLastPulledId: highestSeen, haloLastPulledAt: new Date() })
          .where(eq(tenants.slug, session.tenantSlug));
      } catch (e: any) {
        errors.push({ message: `Failed to persist watermark after page ${page + 1}: ${e?.message ?? String(e)}` });
      }
    }

    if (items.length < PAGE_SIZE) break;
  }

  // On dry-run we still want the "last attempted" timestamp surfaced; on a
  // real pull with zero new items the per-page block above never ran, so
  // touch the timestamp here too.
  if (!dryRun) {
    await db
      .update(tenants)
      .set({ haloLastPulledAt: new Date() })
      .where(eq(tenants.slug, session.tenantSlug));
  }

  await logAuditEvent({
    username: session.username,
    action: "haylo_article.pull_from_halo",
    entityType: "haylo_article",
    details: {
      dryRun,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      previousHighWaterMark: tenantRow.lastPulledId ?? 0,
      newHighWaterMark: dryRun ? (tenantRow.lastPulledId ?? 0) : highestSeen,
    },
  });

  return NextResponse.json({
    dryRun,
    previousHighWaterMark: tenantRow.lastPulledId ?? 0,
    newHighWaterMark: dryRun ? (tenantRow.lastPulledId ?? 0) : highestSeen,
    imported,
    skipped,
    errors,
  });
}

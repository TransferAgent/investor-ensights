import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";
import { requireConductor } from "@/lib/conductor-guard";
import { assertValidSlug } from "@/lib/tenant/provisioner";

// MT-4.13: cross-tenant Haylo paste used by the Persona Wizard's Step 3.
// Single-article create only — the full Haylo Library (scan-inbox, halo pull,
// duplicate detection, etc.) remains in /admin/haylo and is reachable after
// the staffer switches into the new tenant.

const createSchema = z.object({
  title: z.string().min(3).max(300),
  topicSlug: z.string().min(1).max(100).optional(),
  bodyHtml: z.string().min(10),
  summary: z.string().max(1000).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;
  const { session } = guard;

  const { slug: targetSlug } = await params;
  try {
    assertValidSlug(targetSlug);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Invalid slug" }, { status: 400 });
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const baseSlug = slugify(body.title);
  const contentHash = createHash("sha256").update(body.bodyHtml).digest("hex");

  let createdId: string | null = null;
  let usedSlug = baseSlug;
  await withTenantAsync(targetSlug, async () => {
    let attempt = 0;
    while (true) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      const existing = await storage.getHayloArticleBySlug?.(candidate);
      if (!existing) {
        usedSlug = candidate;
        const row = await storage.createHayloArticle(
          {
            slug: candidate,
            title: body.title.trim(),
            topicSlug: body.topicSlug?.trim() || null,
            bodyHtml: body.bodyHtml,
            summary: body.summary?.trim() || null,
            status: "active",
            source: "wizard-paste",
            sourceFilename: null,
          } as any,
          contentHash,
        );
        createdId = (row as any)?.id ?? null;
        return;
      }
      attempt++;
      if (attempt > 50) throw new Error("Could not derive a unique slug");
    }
  });

  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "persona.upload.haylo",
      entityType: "tenant",
      entityId: targetSlug,
      details: { hayloId: createdId, slug: usedSlug, title: body.title },
    }),
  );

  return NextResponse.json({ id: createdId, slug: usedSlug }, { status: 201 });
}

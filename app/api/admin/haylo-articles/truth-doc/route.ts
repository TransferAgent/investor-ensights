import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

// TD-1: same-tenant Truth Document designation, used by the Haylo Library
// (/admin/haylo). The Truth Document is the per-tenant Haylo article the city
// meta LLM grounds on (public.tenants.default_haylo_article_id → a row in this
// tenant's haylo_articles). No truth doc ⇒ city meta writes NOTHING (graceful
// no-op), so designating one is what "turns on" city meta for the tenant.
//
// Cross-tenant designation during onboarding lives in the Conductor-gated
// /api/admin/personas/[slug]/truth-doc route instead.

// hayloArticleId: a uuid to set, or null to clear the pointer. Clearing is a
// reversible pointer change (not a content delete), so it's allowed.
const putSchema = z.object({
  hayloArticleId: z.string().uuid().nullable(),
});

export async function GET(_req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ defaultHayloArticleId: tenants.defaultHayloArticleId })
    .from(tenants)
    .where(eq(tenants.slug, session.tenantSlug))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ defaultHayloArticleId: row.defaultHayloArticleId ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  let docTitle: string | null = null;
  if (body.hayloArticleId) {
    // storage auto-resolves to the session tenant's schema, so this validates
    // the article belongs to THIS tenant (cross-tenant ids simply won't be
    // found) and that it has a non-empty body to ground on.
    const article = await storage.getHayloArticleById(body.hayloArticleId);
    if (!article) {
      return NextResponse.json(
        { error: "Haylo article not found in this tenant" },
        { status: 404 },
      );
    }
    if (!article.bodyHtml || article.bodyHtml.trim().length === 0) {
      return NextResponse.json(
        { error: "Cannot designate a Truth Document with an empty body" },
        { status: 422 },
      );
    }
    docTitle = article.title;
  }

  const [updated] = await db
    .update(tenants)
    .set({ defaultHayloArticleId: body.hayloArticleId })
    .where(eq(tenants.slug, session.tenantSlug))
    .returning({ defaultHayloArticleId: tenants.defaultHayloArticleId });

  if (!updated) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  await logAuditEvent({
    username: session.username,
    action: "haylo.truthdoc.set",
    entityType: "tenant",
    entityId: session.tenantSlug,
    details: { hayloArticleId: body.hayloArticleId, title: docTitle },
  });

  return NextResponse.json({ defaultHayloArticleId: updated.defaultHayloArticleId ?? null });
}

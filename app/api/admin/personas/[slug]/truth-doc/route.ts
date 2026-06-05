import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";
import { requireConductor } from "@/lib/conductor-guard";
import { assertValidSlug } from "@/lib/tenant/provisioner";

// TD-1: cross-tenant Truth Document designation used by the Persona Wizard.
// The Conductor designates the seeded Haylo article as the target tenant's
// truth doc (public.tenants.default_haylo_article_id) so city meta is wired up
// by construction at onboarding. Same-tenant designation (a tenant managing its
// own Library) lives in /api/admin/haylo-articles/truth-doc instead.

const postSchema = z.object({
  hayloArticleId: z.string().uuid(),
});

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

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  // Validate the article exists in the TARGET tenant's schema (not the actor's)
  // and has a non-empty body to ground on.
  const article = await withTenantAsync(targetSlug, () =>
    storage.getHayloArticleById(body.hayloArticleId),
  );
  if (!article) {
    return NextResponse.json(
      { error: "Haylo article not found in target persona" },
      { status: 404 },
    );
  }
  if (!article.bodyHtml || article.bodyHtml.trim().length === 0) {
    return NextResponse.json(
      { error: "Cannot designate a Truth Document with an empty body" },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(tenants)
    .set({ defaultHayloArticleId: body.hayloArticleId })
    .where(eq(tenants.slug, targetSlug))
    .returning({ defaultHayloArticleId: tenants.defaultHayloArticleId });

  if (!updated) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "persona.truthdoc.set",
      entityType: "tenant",
      entityId: targetSlug,
      details: { hayloArticleId: body.hayloArticleId, title: article.title },
    }),
  );

  return NextResponse.json({ defaultHayloArticleId: updated.defaultHayloArticleId ?? null });
}

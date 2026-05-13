import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";
import { isConductor } from "@/lib/conductor-guard";

// MT-4.13: extended PATCH schema to expose the brand_vertical / brand_tagline
// / brand_feature_cta fields that the Persona Wizard (and Tier-2 meta builders)
// rely on. Cross-tenant edits are gated to Conductor; a non-Conductor session
// can only PATCH its own tenant row.
const patchSchema = z.object({
  personaDisplayName: z.string().min(1).max(120).optional(),
  publisherName: z.string().min(1).max(120).optional(),
  authorName: z.string().min(1).max(120).optional(),
  companyName: z.string().min(1).max(200).optional(),
  brandHomeUrl: z.string().url().max(500).nullable().optional(),
  brandVertical: z.string().min(2).max(200).optional(),
  brandTagline: z.string().min(2).max(300).optional(),
  brandFeatureCta: z.string().min(2).max(200).optional(),
  // Empty string = clear; non-empty = set/replace; omitted = leave alone.
  haloDistributionKey: z.string().max(500).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const [row] = await db
    .select({
      slug: tenants.slug,
      personaDisplayName: tenants.personaDisplayName,
      publisherName: tenants.publisherName,
      authorName: tenants.authorName,
      companyName: tenants.companyName,
      brandHomeUrl: tenants.brandHomeUrl,
      brandVertical: tenants.brandVertical,
      brandTagline: tenants.brandTagline,
      brandFeatureCta: tenants.brandFeatureCta,
      haloDistributionKey: tenants.haloDistributionKey,
      haloLastPulledId: tenants.haloLastPulledId,
      haloLastPulledAt: tenants.haloLastPulledAt,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  // Never return the actual key — only whether one is configured.
  const { haloDistributionKey, ...safe } = row;
  return NextResponse.json({
    tenant: {
      ...safe,
      haloKeyIsSet: !!(haloDistributionKey && haloDistributionKey.length > 0),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  // MT-4.13: cross-tenant PATCH is Conductor-only. Same-tenant edits remain
  // available to any tenant_admin so each tenant can still self-manage brand.
  if (slug !== session.tenantSlug && !isConductor(session)) {
    return NextResponse.json(
      { error: "Forbidden: cross-tenant edits require Conductor access" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if (body.personaDisplayName !== undefined) update.personaDisplayName = body.personaDisplayName.trim();
  if (body.publisherName !== undefined) update.publisherName = body.publisherName.trim();
  if (body.authorName !== undefined) update.authorName = body.authorName.trim();
  if (body.companyName !== undefined) update.companyName = body.companyName.trim();
  if (body.brandHomeUrl !== undefined) update.brandHomeUrl = body.brandHomeUrl?.trim() || null;
  if (body.brandVertical !== undefined) update.brandVertical = body.brandVertical.trim();
  if (body.brandTagline !== undefined) update.brandTagline = body.brandTagline.trim();
  if (body.brandFeatureCta !== undefined) update.brandFeatureCta = body.brandFeatureCta.trim();
  if (body.haloDistributionKey !== undefined) {
    const trimmed = body.haloDistributionKey?.trim();
    update.haloDistributionKey = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(tenants)
    .set(update)
    .where(eq(tenants.slug, slug))
    .returning({
      slug: tenants.slug,
      personaDisplayName: tenants.personaDisplayName,
      publisherName: tenants.publisherName,
      authorName: tenants.authorName,
      companyName: tenants.companyName,
      brandHomeUrl: tenants.brandHomeUrl,
      brandVertical: tenants.brandVertical,
      brandTagline: tenants.brandTagline,
      brandFeatureCta: tenants.brandFeatureCta,
      haloDistributionKey: tenants.haloDistributionKey,
    });

  if (!updated) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Redact the key from audit details to avoid leaking it into the audit log.
  const safeValues: Record<string, unknown> = { ...update };
  if ("haloDistributionKey" in safeValues) {
    safeValues.haloDistributionKey = safeValues.haloDistributionKey ? "[REDACTED]" : null;
  }

  // Audit goes into the SESSION user's tenant audit log (the actor's tenant).
  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "update",
      entityType: "tenant",
      entityId: slug,
      details: { fields: Object.keys(update), values: safeValues },
    }),
  );

  // Strip the key from the response.
  const { haloDistributionKey, ...safe } = updated;
  return NextResponse.json({
    tenant: { ...safe, haloKeyIsSet: !!(haloDistributionKey && haloDistributionKey.length > 0) },
  });
}

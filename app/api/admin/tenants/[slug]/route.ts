import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { withTenantAsync } from "@/lib/tenant/context";

const patchSchema = z.object({
  personaDisplayName: z.string().min(1).max(120).optional(),
  publisherName: z.string().min(1).max(120).optional(),
  authorName: z.string().min(1).max(120).optional(),
  companyName: z.string().min(1).max(200).optional(),
  brandHomeUrl: z.string().url().max(500).nullable().optional(),
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
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant: row });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

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
    });

  if (!updated) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Audit goes into the SESSION user's tenant audit log (the actor's tenant).
  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "update",
      entityType: "tenant",
      entityId: slug,
      details: { fields: Object.keys(update), values: update },
    }),
  );

  return NextResponse.json({ tenant: updated });
}

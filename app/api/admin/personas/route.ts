import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { tenants, tenantMembers } from "@shared/schema";
import { asc } from "drizzle-orm";
import { db, withTenantAsync } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import { requireConductor } from "@/lib/conductor-guard";
import {
  assertValidSlug,
  provisionTenantSchemaWithClient,
} from "@/lib/tenant/provisioner";

// MT-4.13: Persona Wizard create + list endpoint. Conductor-only. Atomic
// create runs `INSERT public.tenants` + `provisionTenantSchemaWithClient`
// + member binding inside a single pg transaction so a half-provisioned
// tenant can never exist on disk.
export const dynamic = "force-dynamic";

const createSchema = z.object({
  slug: z.string().min(2).max(63),
  personaDisplayName: z.string().min(1).max(100).transform((s) => s.trim()),
  publisherName: z.string().min(1).max(100).transform((s) => s.trim()),
  authorName: z.string().min(1).max(100).transform((s) => s.trim()),
  companyName: z.string().min(1).max(200).transform((s) => s.trim()),
  // MT-4.13.1: brand_* fields are now derived from the Haylo essay at Step 2,
  // not hand-entered at create time. Allow optional placeholders so Step 1
  // can be staff-minimal; the wizard PATCHes the real values after derive.
  brandVertical: z.string().max(200).optional(),
  brandTagline: z.string().max(300).optional(),
  brandFeatureCta: z.string().max(200).optional(),
  brandHomeUrl: z.string().url().max(500).nullable().optional(),
  // Confirmation guard from the Wizard — staffer must retype the slug
  // verbatim to flip the irreversible "create" switch (one-way door).
  confirmSlug: z.string(),
});

const BRAND_PLACEHOLDER = "(pending Haylo derive)";

export async function GET() {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;

  const rows = await db
    .select({
      slug: tenants.slug,
      personaDisplayName: tenants.personaDisplayName,
      publisherName: tenants.publisherName,
      authorName: tenants.authorName,
      companyName: tenants.companyName,
      brandVertical: tenants.brandVertical,
      brandTagline: tenants.brandTagline,
      brandFeatureCta: tenants.brandFeatureCta,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(asc(tenants.createdAt));

  return NextResponse.json({ personas: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;
  const { session } = guard;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const slug = body.slug.trim().toLowerCase();
  if (body.confirmSlug.trim() !== slug) {
    return NextResponse.json(
      { error: "Confirmation slug does not match. Re-type the slug exactly." },
      { status: 400 },
    );
  }

  try {
    assertValidSlug(slug);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid slug" },
      { status: 400 },
    );
  }

  // Atomic create: pre-flight uniqueness check + insert + schema provision +
  // optional first-member binding, all inside one transaction. Rollback on
  // any failure leaves the system byte-identical to its pre-call state.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT 1 FROM public.tenants WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `A persona with slug "${slug}" already exists.` },
        { status: 409 },
      );
    }

    await client.query(
      `INSERT INTO public.tenants
         (slug, persona_display_name, publisher_name, author_name,
          company_name, brand_home_url, brand_vertical, brand_tagline,
          brand_feature_cta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        slug,
        body.personaDisplayName,
        body.publisherName,
        body.authorName,
        body.companyName,
        body.brandHomeUrl?.trim() || null,
        body.brandVertical?.trim() || BRAND_PLACEHOLDER,
        body.brandTagline?.trim() || BRAND_PLACEHOLDER,
        body.brandFeatureCta?.trim() || BRAND_PLACEHOLDER,
      ],
    );

    // Provision tenant_<slug> schema with all per-tenant table shells.
    await provisionTenantSchemaWithClient(client, slug);

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json(
      { error: err?.message || "Failed to create persona" },
      { status: 500 },
    );
  } finally {
    client.release();
    await pool.end();
  }

  // Audit goes into the actor's (Conductor) tenant audit log.
  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "persona.create",
      entityType: "tenant",
      entityId: slug,
      details: {
        personaDisplayName: body.personaDisplayName,
        publisherName: body.publisherName,
        companyName: body.companyName,
      },
    }),
  );

  return NextResponse.json({ slug }, { status: 201 });
}

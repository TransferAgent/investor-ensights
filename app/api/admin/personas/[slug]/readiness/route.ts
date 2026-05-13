import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireConductor } from "@/lib/conductor-guard";
import { assertValidSlug } from "@/lib/tenant/provisioner";

// MT-4.13: server-driven gate state for the Persona Wizard. The Wizard's
// "Next" / "Finish" buttons are disabled until the relevant flags here are
// true — staff cannot bypass by tampering with the client.
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await requireConductor();
  if ("response" in guard) return guard.response;

  const { slug } = await params;
  try {
    assertValidSlug(slug);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid slug" },
      { status: 400 },
    );
  }

  const [tenantRow] = await db
    .select({
      slug: tenants.slug,
      personaDisplayName: tenants.personaDisplayName,
      publisherName: tenants.publisherName,
      authorName: tenants.authorName,
      companyName: tenants.companyName,
      brandVertical: tenants.brandVertical,
      brandTagline: tenants.brandTagline,
      brandFeatureCta: tenants.brandFeatureCta,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenantRow) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  // Brand readiness: every brand_* field must be non-empty.
  const brandComplete = !!(
    tenantRow.personaDisplayName &&
    tenantRow.publisherName &&
    tenantRow.authorName &&
    tenantRow.companyName &&
    tenantRow.brandVertical?.trim() &&
    tenantRow.brandTagline?.trim() &&
    tenantRow.brandFeatureCta?.trim()
  );

  // Direct counts in the tenant schema. Use a dedicated pool with explicit
  // search_path so we never depend on the AsyncLocalStorage tenant context
  // (the Wizard is always operating against a non-actor tenant).
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let cityCount = 0;
  let cityWithResearchSourceCount = 0;
  let hayloCount = 0;
  try {
    const c = pool;
    const r1 = await c.query(
      `SELECT COUNT(*)::int AS n FROM "tenant_${slug}".city_locations`,
    );
    cityCount = r1.rows[0]?.n ?? 0;

    const r2 = await c.query(
      `SELECT COUNT(DISTINCT crs.city_id)::int AS n
         FROM "tenant_${slug}".city_research_sources crs
        WHERE crs.is_enabled = true`,
    );
    cityWithResearchSourceCount = r2.rows[0]?.n ?? 0;

    const r3 = await c.query(
      `SELECT COUNT(*)::int AS n FROM "tenant_${slug}".haylo_articles`,
    );
    hayloCount = r3.rows[0]?.n ?? 0;
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to read tenant state: ${err?.message ?? err}` },
      { status: 500 },
    );
  } finally {
    await pool.end();
  }

  return NextResponse.json({
    slug,
    tenant: tenantRow,
    brand: {
      complete: brandComplete,
    },
    cities: {
      total: cityCount,
      withEnabledResearchSource: cityWithResearchSourceCount,
      // Grounding gate: at least one city must have an enabled research
      // source before the auto-scheduler will pick anything (per replit.md).
      groundingGateOpen: cityWithResearchSourceCount >= 1,
    },
    haylo: {
      total: hayloCount,
      ready: hayloCount >= 1,
    },
    // Aggregate gate used by the Wizard's "Finish" button. Note: research
    // sources are NOT in the hard gate — they're a soft warning surfaced as
    // `cities.groundingGateOpen` so the Wizard can finish before the Conductor
    // runs the per-city research-source auto-seeder (out-of-band today,
    // wired into the Wizard in a follow-on gate MT-4.13.1).
    publishReady: brandComplete && cityCount >= 1 && hayloCount >= 1,
  });
}

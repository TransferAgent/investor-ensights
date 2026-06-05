import { NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { db, withTenantAsync } from "@/lib/db";
import { storage } from "@/lib/storage";
import { tenants, cityLocations } from "@shared/schema";
import { resolveBrandContext } from "@/lib/newsroom/brandContext";
import { generateCityMeta } from "@/lib/cities/cityMetaGenerator";

/**
 * MT-City-Meta G4 — admin trigger: (re)generate the LLM city meta for ONE city.
 *
 * Mirrors the backfill script's contract:
 *   - Truth doc = this tenant's `default_haylo_article_id`. No truth doc ⇒ 422,
 *     nothing written (render fallback keeps serving).
 *   - Overwrite policy mirrors the backfill script: only NULL/'fallback' rows
 *     are eligible. 'manual' and locked rows are always refused (409); an
 *     existing 'llm' row is refused (409) UNLESS the caller passes `?force=1`.
 *     The same whitelist is re-applied as predicates on the UPDATE itself, so a
 *     row that gets locked/curated between the read and the write is still
 *     protected (no TOCTOU overwrite) — a 0-row update returns 409.
 *   - Writes `meta_source='llm'` only on a clean generation; a generation that
 *     fails the contract returns 422 and writes NOTHING (never a degraded value).
 *   - Forward-only: writes ONLY meta_title/meta_description/meta_source — never
 *     touches `updated_at` (so sitemap last-mod stays content-driven), which is
 *     why it writes via `db` directly instead of `storage.updateCity`.
 *
 * Tenant scoping: storage.* calls auto-wrap in the session tenant, but direct
 * `db.*` calls do NOT — so the whole body runs inside
 * `withTenantAsync(session.tenantSlug, …)` to keep every read/write on the
 * caller's own schema.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const { id } = await ctx.params;

  return withTenantAsync(session.tenantSlug, async () => {
    const city = await storage.getCityById(id);
    if (!city) return NextResponse.json({ error: "city not found" }, { status: 404 });

    // Overwrite policy — positive whitelist, identical to the backfill script.
    if (city.metaLockedAt) {
      return NextResponse.json({ error: "city meta is locked", metaSource: city.metaSource }, { status: 409 });
    }
    if (city.metaSource === "manual") {
      return NextResponse.json({ error: "city meta is manually curated", metaSource: "manual" }, { status: 409 });
    }
    if (city.metaSource === "llm" && !force) {
      return NextResponse.json(
        { error: "city meta already generated; pass ?force=1 to regenerate", metaSource: "llm" },
        { status: 409 },
      );
    }
    if (city.metaSource !== null && city.metaSource !== "fallback" && city.metaSource !== "llm") {
      return NextResponse.json(
        { error: "city meta source not eligible for generation", metaSource: city.metaSource },
        { status: 409 },
      );
    }

    // Resolve this tenant's truth document.
    const [tenant] = await db
      .select({ defaultHayloArticleId: tenants.defaultHayloArticleId })
      .from(tenants)
      .where(eq(tenants.slug, session.tenantSlug))
      .limit(1);

    const docId = tenant?.defaultHayloArticleId ?? null;
    if (!docId) {
      return NextResponse.json(
        { error: "no truth document configured for this persona", status: "no-truth-doc" },
        { status: 422 },
      );
    }
    const truthDoc = await storage.getHayloArticleById(docId);
    if (!truthDoc) {
      return NextResponse.json(
        { error: "configured truth document not found", status: "no-truth-doc" },
        { status: 422 },
      );
    }

    const brand = await resolveBrandContext(session.tenantSlug);
    const result = await generateCityMeta({
      brand,
      cityName: city.cityName,
      stateCode: city.stateCode,
      truthDocTitle: truthDoc.title,
      truthDocBody: truthDoc.bodyHtml,
    });

    if (result.status !== "generated" || !result.title || !result.description) {
      // Compute-only failed the contract — write nothing.
      return NextResponse.json(
        {
          error: "generation did not pass the contract",
          status: result.status,
          rejectionReason: result.rejectionReason,
          costUsd: result.costUsd,
        },
        { status: 422 },
      );
    }

    // Write-time guard mirrors the read-time whitelist so a row locked/curated
    // since the check above can't be clobbered. Forward-only: only the three
    // meta columns (NOT storage.updateCity, which would stamp updated_at).
    const sourceConds = [isNull(cityLocations.metaSource), eq(cityLocations.metaSource, "fallback")];
    if (force) sourceConds.push(eq(cityLocations.metaSource, "llm"));

    const updatedRows = await db
      .update(cityLocations)
      .set({ metaTitle: result.title, metaDescription: result.description, metaSource: "llm" })
      .where(and(eq(cityLocations.id, id), isNull(cityLocations.metaLockedAt), or(...sourceConds)))
      .returning({ metaLockedAt: cityLocations.metaLockedAt });

    if (updatedRows.length === 0) {
      // Lost a race: the row was locked/curated between the read and the write.
      return NextResponse.json(
        { error: "city meta changed since check; not overwritten", status: "conflict" },
        { status: 409 },
      );
    }

    await logAuditEvent({
      username: session.username,
      action: "city.meta.generated",
      entityType: "city_location",
      entityId: id,
      details: {
        slug: city.slug,
        metaSource: "llm",
        titleLength: result.title.length,
        descriptionLength: result.description.length,
        costUsd: result.costUsd,
        model: result.model,
      },
    });

    return NextResponse.json({
      ok: true,
      city: { id, slug: city.slug },
      metaTitle: result.title,
      metaDescription: result.description,
      metaSource: "llm",
      costUsd: result.costUsd,
      model: result.model,
      metaLockedAt: updatedRows[0]?.metaLockedAt ?? null,
    });
  });
}

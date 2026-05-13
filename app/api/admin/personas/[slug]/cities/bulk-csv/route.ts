import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { geocodeAddress } from "@/lib/geocoding";
import { withTenantAsync } from "@/lib/tenant/context";
import { requireConductor } from "@/lib/conductor-guard";
import { assertValidSlug } from "@/lib/tenant/provisioner";

// MT-4.13: cross-tenant City Batch upload used exclusively by the Persona
// Wizard. Mirrors the same-tenant /api/admin/cities/bulk-csv route but runs
// inside the TARGET tenant's context so the Conductor can seed cities for a
// newly created persona without a session swap.
//
// Slug strategy: identical to the same-tenant route. For tableicity (the
// Conductor's home tenant) slugs are bare; for every other tenant the
// persona slug is appended (e.g. "austin-tx-acme").
const TABLEICITY_SLUG = "tableicity";

function buildCitySlug(cityName: string, stateCode: string, tenantSlug: string): string {
  const base = `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stateCode.toLowerCase()}`;
  if (tenantSlug === TABLEICITY_SLUG) return base;
  return `${base}-${tenantSlug}`;
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

  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const results = {
    created: 0,
    skipped: 0,
    geocoded: 0,
    geocodeFailed: 0,
    errors: [] as string[],
  };

  await withTenantAsync(targetSlug, async () => {
    const seenInBatch = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cityName = (row.cityName || row.city_name || "").trim();
      const stateCode = (row.stateCode || row.state_code || "").trim().toUpperCase();
      if (!cityName || !stateCode) {
        results.errors.push(`Row ${i + 1}: missing city name or state code`);
        results.skipped++;
        continue;
      }
      const slug = buildCitySlug(cityName, stateCode, targetSlug);
      if (seenInBatch.has(slug)) {
        results.errors.push(
          `Row ${i + 1}: "${cityName}, ${stateCode}" duplicates an earlier row in this CSV (slug ${slug})`,
        );
        results.skipped++;
        continue;
      }
      seenInBatch.add(slug);

      const existing = await storage.getCityBySlug(slug);
      if (existing) {
        results.errors.push(
          `Row ${i + 1}: "${cityName}, ${stateCode}" already exists in tenant "${targetSlug}" (slug ${slug})`,
        );
        results.skipped++;
        continue;
      }

      let latitude: string | null = (row.latitude || row.lat || "").toString().trim() || null;
      let longitude: string | null = (row.longitude || row.lng || row.lon || "").toString().trim() || null;
      if (!latitude || !longitude) {
        try {
          const geo = await geocodeAddress("", cityName, stateCode);
          if (geo.success) {
            latitude = String(geo.latitude);
            longitude = String(geo.longitude);
            results.geocoded++;
          } else {
            results.geocodeFailed++;
          }
        } catch {
          results.geocodeFailed++;
        }
      }

      try {
        await storage.createCity({
          slug,
          cityName,
          stateCode,
          stateName: row.stateName || row.state_name || null,
          streetAddress: row.streetAddress || row.street_address || null,
          zipCode: row.zipCode || row.zip_code || null,
          phoneNumber: row.phoneNumber || row.phone_number || null,
          email: row.email || null,
          latitude,
          longitude,
          isPublished: false,
          allowIndexing: true,
        } as any);
        results.created++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 1}: ${err?.message ?? err}`);
        results.skipped++;
      }
    }
  });

  // Audit goes into the actor's (Conductor) tenant log, not the target's.
  await withTenantAsync(session.tenantSlug, () =>
    logAuditEvent({
      username: session.email,
      action: "persona.upload.cities",
      entityType: "tenant",
      entityId: targetSlug,
      details: results,
    }),
  );

  return NextResponse.json(results);
}

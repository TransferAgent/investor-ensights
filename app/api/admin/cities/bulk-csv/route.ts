import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const results: { created: number; skipped: number; errors: string[] } = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cityName = (row.cityName || row.city_name || "").trim();
      const stateCode = (row.stateCode || row.state_code || "").trim().toUpperCase();

      if (!cityName || !stateCode) {
        results.errors.push(`Row ${i + 1}: Missing city name or state code`);
        results.skipped++;
        continue;
      }

      const slug = `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stateCode.toLowerCase()}`;
      const existing = await storage.getCityBySlug(slug);
      if (existing) {
        results.errors.push(`Row ${i + 1}: "${cityName}, ${stateCode}" already exists`);
        results.skipped++;
        continue;
      }

      try {
        const landmarks = row.localLandmarks || row.local_landmarks || "";
        const nearby = row.nearbyCities || row.nearby_cities || "";
        await storage.createCity({
          cityName,
          stateCode,
          stateName: (row.stateName || row.state_name || "").trim() || null,
          streetAddress: (row.streetAddress || row.street_address || "").trim() || null,
          zipCode: (row.zipCode || row.zip_code || "").trim() || null,
          phoneNumber: (row.phoneNumber || row.phone_number || "").trim() || null,
          email: (row.email || "").trim() || null,
          slug,
          localLandmarks: typeof landmarks === "string" && landmarks
            ? landmarks.split("|").map((s: string) => s.trim()).filter(Boolean)
            : [],
          nearbyCities: typeof nearby === "string" && nearby
            ? nearby.split("|").map((s: string) => s.trim()).filter(Boolean)
            : [],
          latitude: row.latitude || null,
          longitude: row.longitude || null,
          metaTitle: (row.metaTitle || row.meta_title || "").trim() || null,
          metaDescription: (row.metaDescription || row.meta_description || "").trim() || null,
          allowIndexing: row.allowIndexing !== "false" && row.allow_indexing !== "false",
          isPublished: row.isPublished === "true" || row.is_published === "true",
          displayOrder: parseInt(row.displayOrder || row.display_order || "0", 10) || 0,
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`Row ${i + 1}: ${e.message}`);
        results.skipped++;
      }
    }

    await logAuditEvent({ username: session.username, action: "bulk_csv_import", entityType: "city", details: { created: results.created, skipped: results.skipped } });

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to process CSV" }, { status: 400 });
  }
}

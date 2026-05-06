import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cityIds, action, templateId } = await request.json();

  if (!Array.isArray(cityIds) || cityIds.length === 0) {
    return NextResponse.json({ error: "cityIds required" }, { status: 400 });
  }

  let result: { applied: number; skipped: number } = { applied: cityIds.length, skipped: 0 };

  if (action === "publish") {
    await storage.bulkUpdateCities(cityIds, { isPublished: true });
  } else if (action === "unpublish") {
    await storage.bulkUpdateCities(cityIds, { isPublished: false });
  } else if (action === "noindex") {
    await storage.bulkUpdateCities(cityIds, { allowIndexing: false });
  } else if (action === "index") {
    const cities = await storage.getCities(false);
    const byId = new Map(cities.map((c) => [c.id, c]));
    const eligible: string[] = [];
    let skipped = 0;
    for (const id of cityIds) {
      const c = byId.get(id);
      if (c && c.isPublished) eligible.push(id);
      else skipped += 1;
    }
    if (eligible.length > 0) {
      await storage.bulkUpdateCities(eligible, { allowIndexing: true });
    }
    result = { applied: eligible.length, skipped };
  } else if (action === "assign_template" && templateId) {
    await storage.bulkAssignTemplate(cityIds, templateId);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await logAuditEvent({ username: session.username, action: action, entityType: "city", details: { cityIds, templateId, ...result } });

  return NextResponse.json({ success: true, ...result });
}

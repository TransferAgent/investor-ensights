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

  if (action === "publish") {
    await storage.bulkUpdateCities(cityIds, { isPublished: true });
  } else if (action === "unpublish") {
    await storage.bulkUpdateCities(cityIds, { isPublished: false });
  } else if (action === "assign_template" && templateId) {
    await storage.bulkAssignTemplate(cityIds, templateId);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await logAuditEvent({ username: session.username, action: action, entityType: "city", details: { cityIds, templateId } });

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pageId } = await params;
  const { slideId, direction } = await request.json();

  if (!slideId || !["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "slideId and direction (up/down) are required" }, { status: 400 });
  }

  await storage.reorderSlides(pageId, slideId, direction);
  await logAuditEvent({ username: session.username, action: "reorder", entityType: "slide", entityId: slideId, details: { pageId, direction } });

  const slides = await storage.getSlidesByPageId(pageId);
  return NextResponse.json(slides);
}

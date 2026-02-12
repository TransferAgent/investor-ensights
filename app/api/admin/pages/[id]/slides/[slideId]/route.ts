import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { SlideContentSchema } from "@shared/schema";

const VALID_SLIDE_TYPES = ["hero", "features", "pricing", "text", "image_text", "cta", "html"];

function sanitizeHtmlContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pageId, slideId } = await params;

  try {
    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.slideType !== undefined) {
      if (!VALID_SLIDE_TYPES.includes(body.slideType)) {
        return NextResponse.json({ error: `Invalid slide type: ${body.slideType}` }, { status: 400 });
      }
      updateData.slideType = body.slideType;
    }

    const slideType = body.slideType || "unknown";

    if (body.contentJson !== undefined) {
      if (slideType === "html") {
        if (body.contentJson?.html) {
          updateData.contentJson = { ...body.contentJson, html: sanitizeHtmlContent(body.contentJson.html) };
        } else {
          updateData.contentJson = body.contentJson;
        }
      } else {
        const parsed = SlideContentSchema.safeParse(body.contentJson);
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid slide content", details: parsed.error.issues }, { status: 400 });
        }
        updateData.contentJson = body.contentJson;
      }
    }

    if (body.contentHtml !== undefined) updateData.contentHtml = body.contentHtml ? sanitizeHtmlContent(body.contentHtml) : null;
    if (body.backgroundColor !== undefined) updateData.backgroundColor = body.backgroundColor;
    if (body.paddingClass !== undefined) updateData.paddingClass = body.paddingClass;
    if (body.containerWidth !== undefined) updateData.containerWidth = body.containerWidth;

    const slide = await storage.updateSlide(slideId, updateData);
    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    await logAuditEvent({ username: session.username, action: "update", entityType: "slide", entityId: slideId, details: { pageId } });
    return NextResponse.json(slide);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update slide" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pageId, slideId } = await params;
  await storage.deleteSlide(slideId);
  await logAuditEvent({ username: session.username, action: "delete", entityType: "slide", entityId: slideId, details: { pageId } });
  return NextResponse.json({ success: true });
}

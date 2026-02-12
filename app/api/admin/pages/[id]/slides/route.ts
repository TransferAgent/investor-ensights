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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const slides = await storage.getSlidesByPageId(id);
  return NextResponse.json(slides);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pageId } = await params;
  const page = await storage.getPageById(pageId);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const slideType = body.slideType;

    if (!VALID_SLIDE_TYPES.includes(slideType)) {
      return NextResponse.json({ error: `Invalid slide type: ${slideType}` }, { status: 400 });
    }

    let contentJson = body.contentJson;

    if (slideType === "html") {
      if (contentJson?.html) {
        contentJson = { ...contentJson, html: sanitizeHtmlContent(contentJson.html) };
      }
    } else {
      const parsed = SlideContentSchema.safeParse(contentJson);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid slide content", details: parsed.error.issues }, { status: 400 });
      }
    }

    const existingSlides = await storage.getSlidesByPageId(pageId);
    const nextOrder = existingSlides.length > 0 ? Math.max(...existingSlides.map(s => s.slideOrder)) + 1 : 0;

    const slide = await storage.createSlide({
      pageId,
      slideType,
      slideOrder: body.slideOrder ?? nextOrder,
      contentJson,
      contentHtml: body.contentHtml ? sanitizeHtmlContent(body.contentHtml) : null,
      backgroundColor: body.backgroundColor || null,
      paddingClass: body.paddingClass || null,
      containerWidth: body.containerWidth || null,
    });

    await logAuditEvent({ username: session.username, action: "create", entityType: "slide", entityId: slide.id, details: { pageId } });
    return NextResponse.json(slide, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create slide" }, { status: 400 });
  }
}

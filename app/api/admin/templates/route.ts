import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await storage.getTemplates(false);
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const template = await storage.createTemplate(body);
    return NextResponse.json(template, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create template" }, { status: 400 });
  }
}

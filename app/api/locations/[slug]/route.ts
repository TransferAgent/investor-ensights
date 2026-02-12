import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const city = await storage.getCityBySlug(slug);
  if (!city) {
    return NextResponse.json({ error: "City not found" }, { status: 404 });
  }

  const assignment = await storage.getAssignmentByCityId(city.id);
  let template = null;
  if (assignment?.templateId) {
    template = await storage.getTemplateById(assignment.templateId);
  }

  return NextResponse.json({ city, template, assignment });
}

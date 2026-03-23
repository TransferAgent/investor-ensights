import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeGenerationLog } from "@shared/schema";
import { eq } from "drizzle-orm";

function replacePlaceholders(pattern: string, city: Record<string, any>): string {
  return pattern
    .replace(/\{\{city\}\}/g, city.cityName)
    .replace(/\{\{city_upper\}\}/g, city.cityName.toUpperCase())
    .replace(/\{\{state_name\}\}/g, city.stateName || "")
    .replace(/\{\{state_code\}\}/g, city.stateCode || "")
    .replace(/\{\{slug\}\}/g, city.slug)
    .replace(/\{\{landmarks\}\}/g, (city.localLandmarks || city.landmarks || []).join(", ") || "local business districts")
    .replace(/\{\{nearby_cities\}\}/g, (city.nearbyCities || []).join(", ") || "surrounding communities");
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId, autoPublish } = await req.json();
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  const template = await storage.getKnowledgeTemplateById(templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const cities = await storage.getCities(true);
  const realCities = cities.filter(c => !c.slug.startsWith("testcity") && !c.slug.startsWith("seotestcity"));

  const results: { city: string; slug: string; status: string; error?: string }[] = [];

  for (const city of realCities) {
    try {
      const cityNameSlug = city.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const articleSlug = `tableicity-${cityNameSlug}-cap-table`;
      const title = replacePlaceholders(template.titlePattern, city);
      const headline = replacePlaceholders(template.headlinePattern, city);
      const subheadline = template.subheadlinePattern ? replacePlaceholders(template.subheadlinePattern, city) : undefined;
      const metaDescription = template.metaDescriptionPattern ? replacePlaceholders(template.metaDescriptionPattern, city) : undefined;
      const dateline = template.datelinePattern ? replacePlaceholders(template.datelinePattern, city) : undefined;
      const bodyHtml = replacePlaceholders(template.bodyHtmlPattern, city);
      const boilerplateHtml = template.boilerplateHtml || undefined;

      const now = new Date();
      const articleStatus = autoPublish ? "published" : "pending";

      const [article] = await db.insert(knowledgeArticles).values({
        slug: articleSlug,
        citySlug: city.slug,
        status: articleStatus,
        title,
        headline,
        subheadline,
        metaDescription,
        dateline,
        bodyHtml,
        boilerplateHtml,
        ogImageUrl: template.ogImageUrl || "https://www.tableicity.com/slideshow-b.png",
        robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
        canonicalUrl: `https://www.tableicity.com/discovery/knowledge/${articleSlug}`,
        datePublished: autoPublish ? now : undefined,
        dateModified: now,
        authorName: "Tableicity",
        publisherName: "Tableicity",
      }).returning();

      await db.insert(knowledgeGenerationLog).values({
        citySlug: city.slug,
        directive: `template:${template.name}`,
        status: "success",
      });

      results.push({ city: city.cityName, slug: articleSlug, status: articleStatus });
    } catch (err: any) {
      await db.insert(knowledgeGenerationLog).values({
        citySlug: city.slug,
        directive: `template:${template.name}`,
        status: "error",
        errorMessage: err.message,
      });
      results.push({ city: city.cityName, slug: "", status: "error", error: err.message });
    }
  }

  await logAuditEvent({
    username: session.username,
    action: "bulk_generate_from_template",
    entityType: "knowledge_template",
    entityId: template.id,
  });

  return NextResponse.json({
    generated: results.filter(r => r.status !== "error").length,
    errors: results.filter(r => r.status === "error").length,
    results,
  });
}

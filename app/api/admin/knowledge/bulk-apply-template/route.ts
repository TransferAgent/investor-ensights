import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeGenerationLog } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

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

  const { articleIds, templateId } = await req.json();
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });
  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return NextResponse.json({ error: "articleIds required" }, { status: 400 });
  }

  const template = await storage.getKnowledgeTemplateById(templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const targetArticles = await db.select().from(knowledgeArticles).where(inArray(knowledgeArticles.id, articleIds));
  if (targetArticles.length === 0) {
    return NextResponse.json({ error: "No articles found" }, { status: 404 });
  }

  const allCities = await storage.getCities(true);
  const cityMap: Record<string, any> = {};
  for (const c of allCities) {
    cityMap[c.slug] = c;
  }

  const results: { articleId: string; city: string; status: string; error?: string }[] = [];
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const article of targetArticles) {
    try {
      if (!article.citySlug) {
        results.push({ articleId: article.id, city: "unknown", status: "skipped", error: "No city linked" });
        skipped++;
        continue;
      }

      const city = cityMap[article.citySlug];
      if (!city) {
        results.push({ articleId: article.id, city: article.citySlug, status: "skipped", error: "City not found" });
        skipped++;
        continue;
      }

      const title = replacePlaceholders(template.titlePattern, city);
      const headline = replacePlaceholders(template.headlinePattern, city);
      const subheadline = template.subheadlinePattern ? replacePlaceholders(template.subheadlinePattern, city) : null;
      const metaDescription = template.metaDescriptionPattern ? replacePlaceholders(template.metaDescriptionPattern, city) : null;
      const dateline = template.datelinePattern ? replacePlaceholders(template.datelinePattern, city) : null;
      const bodyHtml = replacePlaceholders(template.bodyHtmlPattern, city);
      const boilerplateHtml = template.boilerplateHtml || null;

      const now = new Date();

      await db.update(knowledgeArticles)
        .set({
          title,
          headline,
          subheadline,
          metaDescription,
          dateline,
          bodyHtml,
          boilerplateHtml,
          ogImageUrl: template.ogImageUrl || article.ogImageUrl,
          dateModified: now,
        })
        .where(eq(knowledgeArticles.id, article.id));

      await db.insert(knowledgeGenerationLog).values({
        citySlug: article.citySlug,
        directive: `apply-template:${template.name}`,
        status: "success",
      });

      updated++;
      results.push({ articleId: article.id, city: city.cityName, status: "updated" });
    } catch (err: any) {
      errors++;
      results.push({ articleId: article.id, city: article.citySlug || "unknown", status: "error", error: err.message });
    }
  }

  await logAuditEvent({
    username: session.username,
    action: "bulk_apply_template",
    entityType: "knowledge_template",
    entityId: template.id,
  });

  return NextResponse.json({ updated, skipped, errors, results });
}

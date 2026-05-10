import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeGenerationLog, knowledgeCampaigns } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { withAdminAuth } from "@/lib/auth-middleware";

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
  return withAdminAuth(async (session) => {

  const { templateId, autoPublish, citySlugs, updateExisting, campaignName } = await req.json();
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  const template = await storage.getKnowledgeTemplateById(templateId);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const cities = await storage.getCities(true);
  let realCities = cities.filter(c => !c.slug.startsWith("testcity") && !c.slug.startsWith("seotestcity"));

  if (Array.isArray(citySlugs) && citySlugs.length > 0) {
    const slugSet = new Set(citySlugs);
    realCities = realCities.filter(c => slugSet.has(c.slug));
  }

  const cName = campaignName || `${template.name} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  let cSlug = cName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");
  const existingCampaigns = await storage.getCampaigns();
  if (existingCampaigns.some(c => c.slug === cSlug)) {
    cSlug = `${cSlug}-${Date.now().toString(36)}`;
  }
  const campaign = await storage.createCampaign({
    name: cName,
    slug: cSlug,
    templateId,
    status: "active",
    articleCount: 0,
    description: `Generated from template "${template.name}" for ${realCities.length} cities`,
  });

  const results: { city: string; slug: string; status: string; error?: string }[] = [];

  for (const city of realCities) {
    try {
      const cityNameSlug = city.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      const templateSlug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");
      const articleSlug = `tableicity-${cityNameSlug}-${templateSlug}`;
      const title = replacePlaceholders(template.titlePattern, city);
      const headline = replacePlaceholders(template.headlinePattern, city);
      const subheadline = template.subheadlinePattern ? replacePlaceholders(template.subheadlinePattern, city) : undefined;
      const metaDescription = template.metaDescriptionPattern ? replacePlaceholders(template.metaDescriptionPattern, city) : undefined;
      const dateline = template.datelinePattern ? replacePlaceholders(template.datelinePattern, city) : undefined;
      const bodyHtml = replacePlaceholders(template.bodyHtmlPattern, city);
      const boilerplateHtml = template.boilerplateHtml || undefined;

      const now = new Date();
      const articleStatus = autoPublish ? "published" : "pending";
      const robotsForArticle = template.allowIndexing
        ? "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        : "noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

      const existingArticles = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.citySlug, city.slug));
      const existingArticle = existingArticles.find(a => a.slug === articleSlug) || null;

      let article;
      let actionTaken = "created";

      if (existingArticle && updateExisting) {
        [article] = await db.update(knowledgeArticles)
          .set({
            slug: articleSlug,
            title,
            headline,
            subheadline,
            metaDescription,
            dateline,
            bodyHtml,
            boilerplateHtml,
            ogImageUrl: template.ogImageUrl || "https://www.tableicity.com/beast-06-zk-network.png",
            robots: robotsForArticle,
            dateModified: now,
            status: autoPublish ? "published" : "pending",
            datePublished: autoPublish ? (existingArticle.datePublished || now) : null,
            campaignId: campaign.id,
          })
          .where(eq(knowledgeArticles.id, existingArticle.id))
          .returning();
        actionTaken = "updated";
      } else if (existingArticle) {
        results.push({ city: city.cityName, slug: articleSlug, status: "skipped", error: "Article already exists" });
        continue;
      } else {
        [article] = await db.insert(knowledgeArticles).values({
          slug: articleSlug,
          citySlug: city.slug,
          campaignId: campaign.id,
          status: articleStatus,
          title,
          headline,
          subheadline,
          metaDescription,
          dateline,
          bodyHtml,
          boilerplateHtml,
          ogImageUrl: template.ogImageUrl || "https://www.tableicity.com/beast-06-zk-network.png",
          robots: robotsForArticle,
          canonicalUrl: `https://www.tableicity.com/discovery/knowledge/${articleSlug}`,
          datePublished: autoPublish ? now : undefined,
          dateModified: now,
          authorName: "Tableicity",
          publisherName: "Tableicity",
        }).returning();
      }

      await db.insert(knowledgeGenerationLog).values({
        citySlug: city.slug,
        directive: `template:${template.name}`,
        status: "success",
      });

      results.push({ city: city.cityName, slug: articleSlug, status: actionTaken === "updated" ? "updated" : articleStatus });
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

  const successCount = results.filter(r => r.status !== "error" && r.status !== "skipped").length;
  await storage.updateCampaign(campaign.id, { articleCount: successCount });

  await logAuditEvent({
    username: session.username,
    action: "bulk_generate_from_template",
    entityType: "knowledge_template",
    entityId: template.id,
  });

  return NextResponse.json({
    generated: results.filter(r => r.status !== "error" && r.status !== "skipped" && r.status !== "updated").length,
    updated: results.filter(r => r.status === "updated").length,
    skipped: results.filter(r => r.status === "skipped").length,
    errors: results.filter(r => r.status === "error").length,
    campaignId: campaign.id,
    campaignName: campaign.name,
    results,
  });
  });
}

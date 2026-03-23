import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeArticleVersions, knowledgeTemplates, cityLocations } from "@shared/schema";
import { eq, ne, sql } from "drizzle-orm";

function replacePlaceholders(pattern: string, city: Record<string, any>): string {
  return pattern
    .replace(/\{\{city\}\}/g, city.cityName)
    .replace(/\{\{city_upper\}\}/g, city.cityName.toUpperCase())
    .replace(/\{\{state_name\}\}/g, city.stateName || "")
    .replace(/\{\{state_code\}\}/g, city.stateCode || "")
    .replace(/\{\{slug\}\}/g, city.slug)
    .replace(/\{\{landmarks\}\}/g, (city.localLandmarks || []).join(", ") || "local business districts")
    .replace(/\{\{nearby_cities\}\}/g, (city.nearbyCities || []).join(", ") || "surrounding communities");
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { archiveExisting = true, autoPublish = true } = body;

  const [template] = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.isActive, true)).limit(1);

  if (!template) {
    const boilerplate = '<p>Tableicity is a premier SAAS cap table solution dedicated to privacy, security, and founder autonomy. By replacing traditional identity-linked databases with cryptographic hashes and ZK-proofs, Tableicity empowers founders to manage equity ownership with unmatched confidentiality. Learn more at <a href="https://www.tableicity.com">www.tableicity.com</a>.</p>';

    const bodyHtml = `<p><strong>FOR IMMEDIATE RELEASE</strong></p>

<p><strong>{{city}}, {{state_name}}</strong> — As private market valuations reach new heights, the risk of centralized data exposure has become a multimillion-dollar liability for startups. Today, <strong>Tableicity</strong> announces expanded availability of its next-generation capitalization (cap table) management platform to founders in {{city}} and across {{state_name}}, specifically engineered to eliminate the security vulnerabilities found in legacy systems like <strong>Carta</strong> and <strong>Cake Equity</strong>.</p>

<p>In an era where a single leaked screenshot of a cap table can derail a funding round or trigger premature tax events, Tableicity introduces a &ldquo;Privacy-First&rdquo; paradigm for founders near {{landmarks}} who refuse to treat their ownership data as public property.</p>

<figure style="margin: 2rem 0;">
<img src="/slideshow-b.png" alt="Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control for {{city}}, {{state_code}} founders." style="width: 100%; border-radius: 12px; display: block;" />
</figure>

<h2>The End of the &ldquo;Data Honey-Pot&rdquo; for {{city}} Startups</h2>

<p>Unlike traditional platforms that store identifiable shareholder data in centralized databases, Tableicity utilizes <strong>SHA-256 Hashing</strong> and <strong>Zero-Knowledge Proofs (ZKPs)</strong> to ensure stakeholder identities remain pseudonymous by default. This technical moat protects {{city}}-area startups from the &ldquo;information asymmetry&rdquo; often exploited by competitors and aggressive VCs during negotiations.</p>

<p><em>&ldquo;The current industry standard is a &lsquo;data honey-pot&rsquo; waiting to be breached,&rdquo;</em> said the Founder of Tableicity. <em>&ldquo;We&rsquo;ve built Tableicity to give founders in {{city}} and across {{state_name}} total control. Your equity ownership remains a hash on a ledger until you decide otherwise.&rdquo;</em></p>

<h2>Key Innovation: On-Demand Auditor Reveal</h2>

<p>Tableicity&rsquo;s standout feature, the <strong>On-Demand Auditor Reveal</strong>, allows founders to grant time-boxed, 30-minute consent access to verified auditors or legal counsel. Once the window expires, the sensitive data automatically re-hashes, ensuring that records are only visible when absolutely necessary for compliance.</p>

<ul>
<li><strong>Zero-Knowledge Dilution Proofs:</strong> Prove dilution impact without exposing raw numbers or specific identities.</li>
<li><strong>Tamper-Proof Ledger:</strong> SHA-256 hashes ensure a permanent audit trail satisfying SEC/FINRA requirements.</li>
<li><strong>Borderless Equity Management:</strong> Supports pseudonymous ownership across global jurisdictions.</li>
<li><strong>Automated 409A Integration:</strong> Seamless valuation workflows that keep {{city}} startups compliant with IRS requirements.</li>
<li><strong>Multi-class Equity Tracking:</strong> Support for common stock, preferred shares, SAFEs, convertible notes, and options pools.</li>
</ul>

<p>As {{city}}&rsquo;s startup scene continues to grow alongside {{nearby_cities}}, Tableicity remains committed to providing the infrastructure that enables founders to focus on building their businesses while maintaining institutional-grade equity management.</p>

<p>Tableicity is currently available to founders and CFOs across all 50 US states, with dedicated onboarding support for companies in the {{city}} metropolitan area.</p>`;

    await db.insert(knowledgeTemplates).values({
      name: "Privacy-First Launch Narrative v1",
      titlePattern: "Tableicity Launches Privacy-First Cap Table in {{city}}, {{state_code}} | Tableicity",
      headlinePattern: "{{city}}, {{state_name}} Founders Embrace Privacy-First Cap Table Management with Tableicity",
      subheadlinePattern: "Next-generation cap table platform leverages SHA-256 encryption and Zero-Knowledge Proofs for {{city}}-area founders — eliminating security vulnerabilities in legacy equity systems.",
      metaDescriptionPattern: "Tableicity launches privacy-first cap table management for founders in {{city}}, {{state_name}}. SHA-256 hashing, Zero-Knowledge Proofs, on-demand auditor reveal, and tamper-proof ledger for startups.",
      datelinePattern: "{{city_upper}}, {{state_code}} —",
      bodyHtmlPattern: bodyHtml,
      boilerplateHtml: boilerplate,
      ogImageUrl: "https://www.tableicity.com/slideshow-b.png",
      isActive: true,
    });
  }

  const [activeTemplate] = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.isActive, true)).limit(1);

  let archivedCount = 0;
  if (archiveExisting) {
    const existing = await db.select().from(knowledgeArticles).where(ne(knowledgeArticles.status, "archived"));
    for (const article of existing) {
      const [versionCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, article.id));
      const nextVersion = Number(versionCount.count) + 1;
      await db.insert(knowledgeArticleVersions).values({
        articleId: article.id,
        versionNumber: nextVersion,
        snapshotJson: JSON.parse(JSON.stringify(article)),
        snapshotReason: "archive",
        createdBy: session.username,
      });
      await db.update(knowledgeArticles).set({ status: "archived", dateModified: new Date(), updatedAt: new Date() }).where(eq(knowledgeArticles.id, article.id));
      archivedCount++;
    }
  }

  const cities = await db.select().from(cityLocations).where(eq(cityLocations.isPublished, true));
  const realCities = cities.filter(c => !c.slug.startsWith("testcity") && !c.slug.startsWith("seotestcity"));

  let generatedCount = 0;
  for (const city of realCities) {
    const articleSlug = `${city.slug}-press-${Date.now()}`;
    const now = new Date();
    const status = autoPublish ? "published" : "pending";

    await db.insert(knowledgeArticles).values({
      slug: articleSlug,
      citySlug: city.slug,
      status,
      title: replacePlaceholders(activeTemplate.titlePattern, city),
      headline: replacePlaceholders(activeTemplate.headlinePattern, city),
      subheadline: activeTemplate.subheadlinePattern ? replacePlaceholders(activeTemplate.subheadlinePattern, city) : undefined,
      metaDescription: activeTemplate.metaDescriptionPattern ? replacePlaceholders(activeTemplate.metaDescriptionPattern, city) : undefined,
      dateline: activeTemplate.datelinePattern ? replacePlaceholders(activeTemplate.datelinePattern, city) : undefined,
      bodyHtml: replacePlaceholders(activeTemplate.bodyHtmlPattern, city),
      boilerplateHtml: activeTemplate.boilerplateHtml || undefined,
      ogImageUrl: activeTemplate.ogImageUrl || "https://www.tableicity.com/slideshow-b.png",
      robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      canonicalUrl: `https://www.tableicity.com/discovery/knowledge/${articleSlug}`,
      datePublished: autoPublish ? now : undefined,
      dateModified: now,
      authorName: "Tableicity",
      publisherName: "Tableicity",
    });
    generatedCount++;
  }

  await logAuditEvent({ username: session.username, action: "sync_template", entityType: "knowledge_article", entityId: activeTemplate.id });

  return NextResponse.json({
    archived: archivedCount,
    generated: generatedCount,
    templateName: activeTemplate.name,
    totalCities: realCities.length,
  });
}

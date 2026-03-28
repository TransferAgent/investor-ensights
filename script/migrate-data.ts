import { db } from "../lib/db";
import { knowledgeTemplates, knowledgeCampaigns, knowledgeArticles } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

const PR_HASH_TEMPLATE = {
  name: "Tableicity PR Hash-256",
  description: "Hash-256 branded press release template for Tableicity city launches. Covers cap table management, equity compliance, and local business relevance.",
  titlePattern: "{{city}}, {{state_name}} Cap Table Management | Tableicity",
  metaDescriptionPattern: "Tableicity brings privacy-first cap table management to {{city}}, {{state_name}}. Discover how founders near {{landmarks}} are securing equity with blockchain-grade encryption.",
  headlinePattern: "{{city}}, {{state_name}} Founders Embrace Privacy-First Cap Table Management with Tableicity",
  subheadlinePattern: "New platform launch empowers startups and growing companies across {{state_name}} with zero-knowledge equity management",
  bodyHtmlPattern: `<p><strong>{{city}}, {{state_name}}</strong> — Tableicity, the privacy-first cap table management platform, today announced expanded service availability for founders and companies in the {{city}} metropolitan area. The launch brings Tableicity's zero-knowledge equity management technology to one of {{state_name}}'s most dynamic business communities.</p>

<p>As {{city}} continues to attract entrepreneurs and growing companies, the need for secure, compliant cap table management has never been greater. Tableicity's platform addresses this demand with a suite of tools designed specifically for modern founders who prioritize both transparency and privacy.</p>

<h3>Why {{city}} Founders Choose Tableicity</h3>

<p>The {{city}} startup ecosystem, anchored by landmarks like {{landmarks}}, has seen remarkable growth in recent years. Local founders increasingly recognize that traditional spreadsheet-based cap table management introduces unacceptable risks — from data breaches to compliance failures.</p>

<p>Tableicity's platform offers:</p>
<ul>
<li><strong>Zero-Knowledge Architecture:</strong> Equity data is encrypted end-to-end, ensuring that sensitive ownership information remains private even from Tableicity's own servers.</li>
<li><strong>Automated 409A Compliance:</strong> Built-in valuation tracking and compliance workflows reduce the burden on {{city}} founders navigating complex regulatory requirements.</li>
<li><strong>Real-Time Cap Table Sync:</strong> Multiple stakeholders across {{city}} and neighboring cities like {{nearby_cities}} can access up-to-date equity information simultaneously.</li>
<li><strong>Investor-Ready Reporting:</strong> Generate professional cap table reports, waterfall analyses, and scenario modeling with a single click.</li>
</ul>

<h3>Serving the Greater {{city}} Business Community</h3>

<p>"We've seen tremendous demand from {{state_name}} founders who want enterprise-grade equity management without sacrificing privacy," said the Tableicity team. "{{city}} represents exactly the kind of innovative, forward-thinking market where our platform thrives."</p>

<p>The expansion also serves businesses in nearby communities including {{nearby_cities}}, extending Tableicity's reach across the broader {{state_name}} region.</p>

<h3>About Tableicity</h3>

<p>Tableicity is a privacy-first cap table management platform that combines zero-knowledge encryption with intuitive equity management tools. Designed for founders, CFOs, and legal teams, Tableicity simplifies cap table administration while maintaining the highest standards of data security and regulatory compliance.</p>`,
  boilerplateHtmlPattern: `<p><strong>Media Contact:</strong><br>Tableicity Communications<br>press@tableicity.com<br>www.tableicity.com</p>

<p><em>Tableicity is available to founders and companies in {{city}}, {{state_name}} and surrounding areas including {{nearby_cities}}. Visit www.tableicity.com to learn more about privacy-first cap table management.</em></p>`,
  ogImageUrl: "/slideshow-b.png",
  isActive: true,
};

async function migrateData() {
  console.log("Running data migration...");

  const existingTemplates = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.name, PR_HASH_TEMPLATE.name));
  
  let templateId: string;
  if (existingTemplates.length === 0) {
    console.log("Creating PR Hash-256 template...");
    const [template] = await db.insert(knowledgeTemplates).values(PR_HASH_TEMPLATE).returning();
    templateId = template.id;
    console.log(`Created template: ${template.id}`);
  } else {
    templateId = existingTemplates[0].id;
    console.log(`PR Hash-256 template already exists: ${templateId}`);
  }

  const existingCampaigns = await db.select().from(knowledgeCampaigns).where(eq(knowledgeCampaigns.slug, "pr-hash-256-launch-campaign"));
  
  let campaignId: string;
  if (existingCampaigns.length === 0) {
    console.log("Creating PR Hash-256 Launch Campaign...");
    const allArticles = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.status, "published"));
    const [campaign] = await db.insert(knowledgeCampaigns).values({
      name: "PR Hash-256 — Launch Campaign",
      slug: "pr-hash-256-launch-campaign",
      templateId: templateId,
      status: "active",
      description: "Original Privacy-First Launch Narrative press releases across all cities",
      articleCount: allArticles.length,
    }).returning();
    campaignId = campaign.id;
    console.log(`Created campaign: ${campaign.id} with ${allArticles.length} articles`);

    if (allArticles.length > 0) {
      console.log("Assigning existing articles to campaign...");
      await db.update(knowledgeArticles)
        .set({ campaignId: campaignId })
        .where(eq(knowledgeArticles.status, "published"));
      console.log(`Assigned ${allArticles.length} articles to campaign`);
    }
  } else {
    console.log(`Campaign already exists: ${existingCampaigns[0].id}`);
  }

  // Step 3: Create Privacy-First Launch Campaign for any uncategorized articles
  const existingPrivacyCampaign = await db.select().from(knowledgeCampaigns).where(eq(knowledgeCampaigns.slug, "privacy-first-launch-campaign"));
  
  if (existingPrivacyCampaign.length === 0) {
    const uncategorizedArticles = await db.select().from(knowledgeArticles).where(isNull(knowledgeArticles.campaignId));
    
    if (uncategorizedArticles.length > 0) {
      const privacyTemplates = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.name, "Privacy-First Launch Narrative v1"));
      const privacyTemplateId = privacyTemplates.length > 0 ? privacyTemplates[0].id : null;
      
      console.log("Creating Privacy-First Launch Campaign...");
      const [privacyCampaign] = await db.insert(knowledgeCampaigns).values({
        name: "Privacy-First Launch Campaign",
        slug: "privacy-first-launch-campaign",
        templateId: privacyTemplateId,
        status: "active",
        description: "Legacy Privacy-First Launch Narrative press releases",
        articleCount: uncategorizedArticles.length,
      }).returning();
      
      await db.update(knowledgeArticles)
        .set({ campaignId: privacyCampaign.id })
        .where(isNull(knowledgeArticles.campaignId));
      console.log("Assigned " + uncategorizedArticles.length + " uncategorized articles to Privacy-First Launch Campaign: " + privacyCampaign.id);
    } else {
      console.log("No uncategorized articles found, skipping Privacy-First campaign creation");
    }
  } else {
    console.log("Privacy-First Launch Campaign already exists: " + existingPrivacyCampaign[0].id);
  }

  console.log("Data migration complete!");
}

migrateData().catch((err) => {
  console.error("Data migration error:", err);
  process.exit(1);
});

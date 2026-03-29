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

  // Step 3: Create ZKP NOIR Press Release template
  const existingZkpTemplate = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.name, "ZKP NOIR Press Release v1"));
  if (existingZkpTemplate.length === 0) {
    console.log("Creating ZKP NOIR Press Release template...");
    const [zkpTemplate] = await db.insert(knowledgeTemplates).values({
      name: "ZKP NOIR Press Release v1",
      description: "Zero-Knowledge Proofs and NOIR Evidence Engine press release. Covers ZKP fundamentals, NOIR architecture, competitive differentiation, and global strategy.",
      titlePattern: "{{city}}, {{state_name}} — Why Zero-Knowledge Proofs and NOIR Matter for Cap Table Security | Tableicity",
      metaDescriptionPattern: "Tableicity brings Zero-Knowledge Proofs and the NOIR Evidence Engine to {{city}}, {{state_name}}. Founders near {{landmarks}} can now prove equity facts without revealing sensitive data.",
      headlinePattern: "Why Zero-Knowledge Proofs Matter and Why NOIR is the Game-Changer for {{city}}, {{state_name}} Founders",
      subheadlinePattern: "Tableicity deploys its Zero-Knowledge Evidence Engine to protect cap table privacy for startups and investors across {{state_name}}.",
      bodyHtmlPattern: `<p><strong>{{city}}, {{state_name}}</strong> — In the high-stakes world of equity management and cap table security, privacy isn't just a feature — it's a non-negotiable. Enter Zero-Knowledge Proofs (ZKPs), a cryptographic breakthrough that allows companies to prove critical facts about their data without ever revealing the data itself. At Tableicity, we're taking this revolutionary technology to the next level with NOIR, our internal Zero-Knowledge Evidence Engine, designed to redefine trust, compliance, and control for founders, investors, and regulators alike.</p>

<h2>The Privacy Crisis in Equity Management</h2>

<p>Traditional cap table platforms operate on a &quot;public-by-default&quot; model, where sensitive ownership data — names, share counts, and financial stakes — is stored in centralized databases accessible to platform admins, employees, or even regulators with the right login. This exposure is a ticking time bomb for stealth startups, high-net-worth investors, and pre-IPO companies who cannot afford their portfolios to be scraped by competitors or exposed in data breaches.</p>

<p>Zero-Knowledge Proofs solve this crisis at its core. Unlike conventional encryption (like SHA-256, which creates a verifiable &quot;fingerprint&quot; of data), ZKPs allow a company to prove a statement — such as &quot;This investor owns at least 10% of the company&quot; — without disclosing the raw numbers or identities behind it. This is the Privacy Shield that Tableicity is deploying through NOIR for founders in {{city}} and across {{state_name}}.</p>

<figure>
<img src="/beast-03-masked-table.png" alt="Tableicity Cap Table Dashboard showing encrypted stakeholder identities with pseudonymous hash labels for {{city}}, {{state_name}} founders" width="1200" />
<figcaption>Tableicity's encrypted cap table view — stakeholder identities protected by SHA-256 hashing</figcaption>
</figure>

<h2>Why ZKPs Are a Strategic Imperative</h2>

<p>For startups and high-growth companies in {{city}} navigating fundraising, audits, and regulatory scrutiny, ZKPs offer transformative benefits:</p>

<ul>
<li><strong>Selective Disclosure:</strong> Founders can prove to potential lead investors that their cap table is clean or that no single entity owns more than 20%, all without revealing the identities or stakes of other shareholders.</li>
<li><strong>Trustless Audits:</strong> Auditors can verify that the sum of all shares equals 100% or that transactions comply with company bylaws without ever accessing personal or financial details.</li>
<li><strong>Regulatory Compliance:</strong> ZKPs enable companies to demonstrate to regulators that KYC (Know Your Customer) checks have been performed on all investors without sharing private ID documents, aligning with SEC and FINRA requirements.</li>
<li><strong>On-Chain Privacy:</strong> For companies exploring blockchain integrations, ZKPs can hide transaction amounts and participant identities while still allowing networks to confirm the validity of every transfer.</li>
</ul>

<p>These capabilities aren't just technical niceties — they're a competitive moat. ZKPs, powered by NOIR, position Tableicity as the only cap table platform that offers true Mathematical Certainty without compromise.</p>

<h2>NOIR: Tableicity's Zero-Knowledge Evidence Engine</h2>

<p>NOIR isn't just a tool; it's the beating heart of Tableicity's privacy-first mission. Built as an internal proving module leveraging open-source NoirJS technology, NOIR delivers browser-based, client-side privacy preservation:</p>

<ul>
<li><strong>The Invisible Process:</strong> When a founder in {{city}} enters sensitive data into Tableicity, NOIR operates locally on their device. It transforms data into a cryptographic commitment, generating a ZK-proof that verifies specific facts without ever uploading readable data to our servers.</li>
<li><strong>The Output:</strong> What reaches Tableicity's cloud isn't a cap table — it's a vault of mathematical proofs. These proofs can be verified by auditors, investors, or regulators through a simple click, confirming the truth of a statement without exposing the underlying equity state.</li>
<li><strong>Proof of Ownership Threshold:</strong> Proves an investor owns at least X shares or Y% on a fully diluted basis without revealing the rest of the cap table.</li>
<li><strong>Proof of Dilution/Change:</strong> Confirms a financing round or issuance shifts a holder's stake from one threshold to another without disclosing unrelated positions.</li>
<li><strong>Proof of Transfer Validity:</strong> Validates that a transfer adheres to company rules, authorized share limits, and ledger consistency — all while keeping data private.</li>
</ul>

<h2>Why NOIR Sets Tableicity Apart</h2>

<p>Competitors like Carta, Pulley, and Cake Equity rely on conventional centralized trust models — encrypted storage, role-based access, and privacy policies that explicitly allow data processing by employees or subprocessors. Tableicity's NOIR flips this model: we've designed a platform where verification happens without us ever seeing the sensitive equity state in readable form.</p>

<p>For stealth companies, pre-IPO issuers, family-office-heavy cap tables, and founders in regulated jurisdictions, NOIR offers sovereignty that no incumbent can match. Whether you're a founder near {{landmarks}} or scaling across {{state_name}}, your cap table remains invisible unless you choose to reveal it.</p>

<h2>The Global Strategic Advantage</h2>

<p>NOIR is a regulatory-grade infrastructure play. With the EU moving toward eIDAS 2.0 and Estonia already integrating ZKP technology into national identity systems, Tableicity is natively aligned with the future of data sovereignty. Whether you're in {{city}} or Berlin, your cap table remains protected.</p>

<h3>About Tableicity</h3>

<p>Tableicity is the next-generation cap table management platform built for privacy and efficiency. By integrating NOIR, our Zero-Knowledge Evidence Engine, alongside Hash-256 Stakeholder Identities, we empower founders to maintain audit-ready records while protecting the anonymity of their equity holders. In a world where data is power, Tableicity ensures that power stays in your hands.</p>`,
      boilerplateHtmlPattern: `<p><strong>Media Contact:</strong><br>Tableicity Communications<br>press@tableicity.com<br>www.tableicity.com</p>
<p><em>Tableicity is available to founders and companies in {{city}}, {{state_name}} and surrounding areas including {{nearby_cities}}. Visit www.tableicity.com to learn more about privacy-first cap table management.</em></p>`,
      ogImageUrl: "/beast-03-masked-table.png",
      isActive: true,
    }).returning();
    console.log("Created ZKP NOIR template: " + zkpTemplate.id);
  } else {
    console.log("ZKP NOIR template already exists: " + existingZkpTemplate[0].id);
  }

  // Step 4: Create Privacy-First Launch Campaign for any uncategorized articles
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

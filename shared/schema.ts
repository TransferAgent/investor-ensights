import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  decimal,
  numeric,
  jsonb,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cityLocations = pgTable(
  "city_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    cityName: varchar("city_name", { length: 100 }).notNull(),
    stateCode: varchar("state_code", { length: 2 }).notNull(),
    stateName: varchar("state_name", { length: 50 }),
    streetAddress: varchar("street_address", { length: 255 }),
    zipCode: varchar("zip_code", { length: 10 }),
    googlePlaceId: varchar("google_place_id", { length: 255 }),
    phoneNumber: varchar("phone_number", { length: 20 }),
    email: varchar("email", { length: 100 }),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    localLandmarks: jsonb("local_landmarks").default([]).notNull(),
    nearbyCities: jsonb("nearby_cities").default([]).notNull(),
    mapEmbedUrl: text("map_embed_url"),
    metaTitle: varchar("meta_title", { length: 120 }),
    metaDescription: varchar("meta_description", { length: 500 }),
    allowIndexing: boolean("allow_indexing").default(true).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("city_locations_slug_idx").on(table.slug),
    index("city_locations_published_idx").on(table.isPublished),
    index("city_locations_state_idx").on(table.stateCode),
  ]
);

export const contentTemplates = pgTable(
  "content_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateName: varchar("template_name", { length: 100 }).notNull(),
    templateDescription: text("template_description"),
    metaTitlePattern: varchar("meta_title_pattern", { length: 120 }),
    metaDescriptionPattern: varchar("meta_description_pattern", { length: 500 }),
    h1HeaderPattern: varchar("h1_header_pattern", { length: 255 }),
    h2SubheaderPattern: varchar("h2_subheader_pattern", { length: 500 }),
    bodyContentPattern: text("body_content_pattern"),
    ctaText: varchar("cta_text", { length: 100 }),
    ctaUrlPattern: varchar("cta_url_pattern", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    allowIndexing: boolean("allow_indexing").default(true).notNull(),
    version: integer("version").default(1).notNull(),
    createdBy: varchar("created_by", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("content_templates_active_idx").on(table.isActive),
  ]
);

export const cityContentAssignments = pgTable(
  "city_content_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id").notNull().references(() => cityLocations.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => contentTemplates.id, { onDelete: "set null" }),
    customMetaTitle: varchar("custom_meta_title", { length: 120 }),
    customMetaDescription: varchar("custom_meta_description", { length: 300 }),
    customH1: varchar("custom_h1", { length: 255 }),
    customBody: text("custom_body"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    assignedBy: varchar("assigned_by", { length: 100 }),
  },
  (table) => [
    uniqueIndex("city_content_assignments_city_idx").on(table.cityId),
    index("city_content_assignments_template_idx").on(table.templateId),
  ]
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
  adminUsername: varchar("admin_username", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCityLocationSchema = createInsertSchema(cityLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentTemplateSchema = createInsertSchema(contentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCityContentAssignmentSchema = createInsertSchema(cityContentAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type CityLocation = typeof cityLocations.$inferSelect;
export type InsertCityLocation = z.infer<typeof insertCityLocationSchema>;
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type InsertContentTemplate = z.infer<typeof insertContentTemplateSchema>;
export type CityContentAssignment = typeof cityContentAssignments.$inferSelect;
export type InsertCityContentAssignment = z.infer<typeof insertCityContentAssignmentSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export const customPages = pgTable(
  "custom_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    pageTitle: varchar("page_title", { length: 100 }).notNull(),
    metaTitle: varchar("meta_title", { length: 120 }),
    metaDescription: varchar("meta_description", { length: 300 }),
    ogImageUrl: varchar("og_image_url", { length: 500 }),
    isPublished: boolean("is_published").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdBy: varchar("created_by", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("custom_pages_slug_idx").on(table.slug),
    index("custom_pages_published_idx").on(table.isPublished),
  ]
);

export const pageSlides = pgTable(
  "page_slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull().references(() => customPages.id, { onDelete: "cascade" }),
    slideType: varchar("slide_type", { length: 50 }).notNull(),
    slideOrder: integer("slide_order").notNull(),
    contentJson: jsonb("content_json").notNull(),
    contentHtml: text("content_html"),
    backgroundColor: varchar("background_color", { length: 50 }),
    paddingClass: varchar("padding_class", { length: 50 }),
    containerWidth: varchar("container_width", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("page_slides_page_order_idx").on(table.pageId, table.slideOrder),
  ]
);

export const HeroSlideSchema = z.object({
  type: z.literal("hero"),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(300).optional(),
  cta_text: z.string().max(50).optional(),
  cta_url: z.string().max(500).optional(),
  background_image: z.string().max(500).optional(),
});

export const FeaturesSlideSchema = z.object({
  type: z.literal("features"),
  layout: z.enum(["3-column", "4-column"]).optional().default("3-column"),
  headline: z.string().max(200).optional(),
  features: z.array(z.object({
    icon: z.string().optional(),
    title: z.string().max(100),
    description: z.string().max(300),
  })).min(1).max(12),
});

export const PricingSlideSchema = z.object({
  type: z.literal("pricing"),
  headline: z.string().max(200).optional(),
  tiers: z.array(z.object({
    name: z.string(),
    price: z.string(),
    popular: z.boolean().optional(),
    features: z.array(z.string()),
    cta_text: z.string(),
    cta_url: z.string().max(500),
  })).min(1).max(5),
});

export const TextSlideSchema = z.object({
  type: z.literal("text"),
  headline: z.string().max(200).optional(),
  body: z.string(),
});

export const ImageTextSlideSchema = z.object({
  type: z.literal("image_text"),
  layout: z.enum(["image-left", "image-right"]).optional().default("image-left"),
  headline: z.string().max(200).optional(),
  body: z.string(),
  image_url: z.string().max(500),
  image_alt: z.string().max(200).optional(),
});

export const CTASlideSchema = z.object({
  type: z.literal("cta"),
  headline: z.string().max(200),
  subheadline: z.string().max(300).optional(),
  cta_text: z.string().max(50),
  cta_url: z.string().max(500),
});

export const HTMLSlideSchema = z.object({
  type: z.literal("html"),
  html: z.string(),
});

export const SlideContentSchema = z.discriminatedUnion("type", [
  HeroSlideSchema,
  FeaturesSlideSchema,
  PricingSlideSchema,
  TextSlideSchema,
  ImageTextSlideSchema,
  CTASlideSchema,
  HTMLSlideSchema,
]);

export type SlideContent = z.infer<typeof SlideContentSchema>;

export const insertCustomPageSchema = createInsertSchema(customPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPageSlideSchema = createInsertSchema(pageSlides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomPage = typeof customPages.$inferSelect;
export type InsertCustomPage = z.infer<typeof insertCustomPageSchema>;
export type PageSlide = typeof pageSlides.$inferSelect;
export type InsertPageSlide = z.infer<typeof insertPageSlideSchema>;

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({ id: true, createdAt: true });
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

export const knowledgeArticles = pgTable(
  "knowledge_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    citySlug: text("city_slug"),
    campaignId: uuid("campaign_id"),
    status: text("status").notNull().default("pending"),
    title: text("title").notNull(),
    metaDescription: text("meta_description"),
    canonicalUrl: text("canonical_url"),
    robots: text("robots").notNull().default("index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"),
    ogImageUrl: text("og_image_url"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    headline: text("headline").notNull(),
    subheadline: text("subheadline"),
    dateline: text("dateline"),
    bodyHtml: text("body_html").notNull(),
    boilerplateHtml: text("boilerplate_html"),
    datePublished: timestamp("date_published", { withTimezone: true }),
    dateModified: timestamp("date_modified", { withTimezone: true }).defaultNow().notNull(),
    authorName: text("author_name").notNull().default("Tableicity"),
    publisherName: text("publisher_name").notNull().default("Tableicity"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    gscImpressions: integer("gsc_impressions").default(0),
    gscClicks: integer("gsc_clicks").default(0),
    gscAvgPosition: numeric("gsc_avg_position", { precision: 5, scale: 2 }).default("0"),
    gscLastSynced: timestamp("gsc_last_synced", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_articles_slug_idx").on(table.slug),
    index("knowledge_articles_status_idx").on(table.status),
    index("knowledge_articles_city_slug_idx").on(table.citySlug),
  ]
);

export const knowledgeGenerationLog = pgTable(
  "knowledge_generation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    citySlug: text("city_slug").notNull(),
    directive: text("directive"),
    status: text("status").notNull().default("success"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_gen_log_created_idx").on(table.createdAt),
  ]
);

export const knowledgeArticleVersions = pgTable(
  "knowledge_article_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull().references(() => knowledgeArticles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    snapshotJson: jsonb("snapshot_json").notNull(),
    snapshotReason: text("snapshot_reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("knowledge_versions_article_idx").on(table.articleId),
  ]
);

export const knowledgeCampaigns = pgTable(
  "knowledge_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    templateId: uuid("template_id"),
    status: text("status").notNull().default("active"),
    description: text("description"),
    articleCount: integer("article_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_campaigns_slug_idx").on(table.slug),
    index("knowledge_campaigns_status_idx").on(table.status),
  ]
);

export const knowledgeTemplates = pgTable(
  "knowledge_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    titlePattern: text("title_pattern").notNull(),
    headlinePattern: text("headline_pattern").notNull(),
    subheadlinePattern: text("subheadline_pattern"),
    metaDescriptionPattern: text("meta_description_pattern"),
    datelinePattern: text("dateline_pattern"),
    bodyHtmlPattern: text("body_html_pattern").notNull(),
    boilerplateHtml: text("boilerplate_html"),
    ogImageUrl: text("og_image_url"),
    isActive: boolean("is_active").notNull().default(true),
    allowIndexing: boolean("allow_indexing").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_templates_active_idx").on(table.isActive),
  ]
);

export const insertKnowledgeTemplateSchema = createInsertSchema(knowledgeTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type KnowledgeTemplate = typeof knowledgeTemplates.$inferSelect;
export type InsertKnowledgeTemplate = z.infer<typeof insertKnowledgeTemplateSchema>;

export const dataStoreFiles = pgTable(
  "data_store_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    fileData: text("file_data").notNull(),
    category: text("category").notNull().default("general"),
    status: text("status").notNull().default("pending"),
    notes: text("notes"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("data_store_status_idx").on(table.status),
    index("data_store_created_idx").on(table.createdAt),
  ]
);

export const insertDataStoreFileSchema = createInsertSchema(dataStoreFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DataStoreFile = typeof dataStoreFiles.$inferSelect;
export type InsertDataStoreFile = z.infer<typeof insertDataStoreFileSchema>;

export const insertKnowledgeCampaignSchema = createInsertSchema(knowledgeCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type KnowledgeCampaign = typeof knowledgeCampaigns.$inferSelect;
export type InsertKnowledgeCampaign = z.infer<typeof insertKnowledgeCampaignSchema>;

export const hayloArticles = pgTable(
  "haylo_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    topicSlug: text("topic_slug").notNull(),
    bodyHtml: text("body_html").notNull(),
    summary: text("summary"),
    status: text("status").notNull().default("ready"),
    source: text("source").notNull().default("paste"),
    sourceFilename: text("source_filename"),
    contentHash: text("content_hash").notNull(),
    placementCount: integer("placement_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("haylo_articles_slug_idx").on(table.slug),
    index("haylo_articles_status_idx").on(table.status),
    index("haylo_articles_topic_idx").on(table.topicSlug),
    uniqueIndex("haylo_articles_content_hash_idx").on(table.contentHash),
  ]
);

export const insertHayloArticleSchema = createInsertSchema(hayloArticles).omit({
  id: true,
  contentHash: true,
  placementCount: true,
  createdAt: true,
  updatedAt: true,
});

export type HayloArticle = typeof hayloArticles.$inferSelect;
export type InsertHayloArticle = z.infer<typeof insertHayloArticleSchema>;

export const insertKnowledgeArticleSchema = createInsertSchema(knowledgeArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  dateModified: true,
});

export const insertKnowledgeArticleVersionSchema = createInsertSchema(knowledgeArticleVersions).omit({
  id: true,
  createdAt: true,
});

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type InsertKnowledgeArticle = z.infer<typeof insertKnowledgeArticleSchema>;
export type KnowledgeArticleVersion = typeof knowledgeArticleVersions.$inferSelect;
export type InsertKnowledgeArticleVersion = z.infer<typeof insertKnowledgeArticleVersionSchema>;

export const newsroomAgents = pgTable(
  "newsroom_agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: varchar("role", { length: 50 }).notNull().unique(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    provider: varchar("provider", { length: 50 }),
    modelEndpoint: varchar("model_endpoint", { length: 255 }),
    providerKeyRef: varchar("provider_key_ref", { length: 100 }),
    systemPrompt: text("system_prompt"),
    sources: jsonb("sources").default([]).notNull(),
    config: jsonb("config").default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_agents_role_idx").on(table.role),
  ]
);

export const newsroomPipelineJobs = pgTable(
  "newsroom_pipeline_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    citySlug: text("city_slug").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("queued"),
    currentStage: varchar("current_stage", { length: 50 }),
    agentsCompleted: jsonb("agents_completed").default([]).notNull(),
    dryRun: boolean("dry_run").default(false).notNull(),
    payload: jsonb("payload").default({}).notNull(),
    errorMessage: text("error_message"),
    claimedBy: varchar("claimed_by", { length: 100 }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_jobs_status_idx").on(table.status),
    index("newsroom_jobs_city_idx").on(table.citySlug),
    index("newsroom_jobs_heartbeat_idx").on(table.heartbeatAt),
  ]
);

export const newsroomAgentRuns = pgTable(
  "newsroom_agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => newsroomAgents.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => newsroomPipelineJobs.id, { onDelete: "set null" }),
    citySlug: text("city_slug"),
    status: varchar("status", { length: 30 }).notNull().default("queued"),
    dryRun: boolean("dry_run").default(false).notNull(),
    input: jsonb("input").default({}).notNull(),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    tokensUsed: integer("tokens_used"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_runs_agent_idx").on(table.agentId),
    index("newsroom_runs_job_idx").on(table.jobId),
    index("newsroom_runs_status_idx").on(table.status),
    index("newsroom_runs_created_idx").on(table.createdAt),
  ]
);

export const newsroomAgentKnowledge = pgTable(
  "newsroom_agent_knowledge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => newsroomAgents.id, { onDelete: "cascade" }),
    citySlug: text("city_slug"),
    key: varchar("key", { length: 255 }).notNull(),
    value: jsonb("value").notNull(),
    sourceUrl: text("source_url"),
    confidence: numeric("confidence", { precision: 5, scale: 2 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("newsroom_knowledge_agent_idx").on(table.agentId),
    index("newsroom_knowledge_city_idx").on(table.citySlug),
    index("newsroom_knowledge_key_idx").on(table.key),
  ]
);

export const newsroomSourceDocuments = pgTable(
  "newsroom_source_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceUrl: text("source_url").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    citySlug: text("city_slug"),
    title: text("title"),
    rawContent: text("raw_content"),
    cleanContent: text("clean_content"),
    fetchedByAgentId: uuid("fetched_by_agent_id").references(() => newsroomAgents.id, { onDelete: "set null" }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_sources_hash_idx").on(table.contentHash),
    index("newsroom_sources_city_idx").on(table.citySlug),
  ]
);

export const newsroomLeadSignals = pgTable(
  "newsroom_lead_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    citySlug: text("city_slug").notNull(),
    companyName: text("company_name").notNull(),
    tierScore: integer("tier_score"),
    fundingTotalUsd: numeric("funding_total_usd", { precision: 14, scale: 2 }),
    investorCount: integer("investor_count"),
    signalType: varchar("signal_type", { length: 50 }),
    payload: jsonb("payload").default({}).notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => newsroomSourceDocuments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_leads_city_idx").on(table.citySlug),
    index("newsroom_leads_tier_idx").on(table.tierScore),
  ]
);

export const newsroomReviewQueue = pgTable(
  "newsroom_review_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => newsroomPipelineJobs.id, { onDelete: "set null" }),
    citySlug: text("city_slug").notNull(),
    draftPayload: jsonb("draft_payload").notNull(),
    qcScore: integer("qc_score"),
    qcNotes: text("qc_notes"),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    reviewerNotes: text("reviewer_notes"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedArticleId: uuid("published_article_id").references(() => knowledgeArticles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_review_status_idx").on(table.status),
    index("newsroom_review_city_idx").on(table.citySlug),
  ]
);

export const newsroomInternalLinkSuggestions = pgTable(
  "newsroom_internal_link_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewQueueId: uuid("review_queue_id").references(() => newsroomReviewQueue.id, { onDelete: "cascade" }),
    articleId: uuid("article_id").references(() => knowledgeArticles.id, { onDelete: "cascade" }),
    targetSlug: text("target_slug").notNull(),
    anchorText: text("anchor_text").notNull(),
    position: integer("position"),
    accepted: boolean("accepted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("newsroom_links_review_idx").on(table.reviewQueueId),
    index("newsroom_links_article_idx").on(table.articleId),
  ]
);

export const insertNewsroomAgentSchema = createInsertSchema(newsroomAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertNewsroomPipelineJobSchema = createInsertSchema(newsroomPipelineJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertNewsroomAgentRunSchema = createInsertSchema(newsroomAgentRuns).omit({
  id: true,
  createdAt: true,
});
export const insertNewsroomAgentKnowledgeSchema = createInsertSchema(newsroomAgentKnowledge).omit({
  id: true,
  fetchedAt: true,
});
export const insertNewsroomReviewQueueSchema = createInsertSchema(newsroomReviewQueue).omit({
  id: true,
  createdAt: true,
});

export type NewsroomAgent = typeof newsroomAgents.$inferSelect;
export type InsertNewsroomAgent = z.infer<typeof insertNewsroomAgentSchema>;
export type NewsroomPipelineJob = typeof newsroomPipelineJobs.$inferSelect;
export type InsertNewsroomPipelineJob = z.infer<typeof insertNewsroomPipelineJobSchema>;
export type NewsroomAgentRun = typeof newsroomAgentRuns.$inferSelect;
export type InsertNewsroomAgentRun = z.infer<typeof insertNewsroomAgentRunSchema>;
export type NewsroomAgentKnowledge = typeof newsroomAgentKnowledge.$inferSelect;
export type NewsroomSourceDocument = typeof newsroomSourceDocuments.$inferSelect;
export type NewsroomLeadSignal = typeof newsroomLeadSignals.$inferSelect;
export type NewsroomReviewQueue = typeof newsroomReviewQueue.$inferSelect;
export type NewsroomInternalLinkSuggestion = typeof newsroomInternalLinkSuggestions.$inferSelect;

export const NEWSROOM_AGENT_ROLES = [
  "researcher",
  "data_analyst",
  "copywriter",
  "seo_qc",
  "internal_linker",
] as const;
export type NewsroomAgentRole = typeof NEWSROOM_AGENT_ROLES[number];

export const NEWSROOM_PIPELINE_STAGES = [
  "researcher",
  "data_analyst",
  "copywriter",
  "seo_qc",
  "internal_linker",
  "review",
  "published",
] as const;
export type NewsroomPipelineStage = typeof NEWSROOM_PIPELINE_STAGES[number];

export const cityResearchSources = pgTable(
  "city_research_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cityLocations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: varchar("label", { length: 200 }),
    enabled: boolean("enabled").default(true).notNull(),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastFetchOk: boolean("last_fetch_ok"),
    lastFetchBytes: integer("last_fetch_bytes"),
    lastFetchError: text("last_fetch_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("city_research_sources_city_idx").on(table.cityId),
    uniqueIndex("city_research_sources_city_url_unq").on(table.cityId, table.url),
  ]
);

export const insertCityResearchSourceSchema = createInsertSchema(cityResearchSources).omit({
  id: true,
  createdAt: true,
  lastFetchedAt: true,
  lastFetchOk: true,
  lastFetchBytes: true,
  lastFetchError: true,
});
export type InsertCityResearchSource = z.infer<typeof insertCityResearchSourceSchema>;
export type CityResearchSource = typeof cityResearchSources.$inferSelect;

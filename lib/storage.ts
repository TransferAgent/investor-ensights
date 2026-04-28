import {
  cityLocations,
  contentTemplates,
  cityContentAssignments,
  adminUsers,
  adminAuditLog,
  customPages,
  pageSlides,
  knowledgeArticles,
  knowledgeArticleVersions,
  knowledgeTemplates,
  knowledgeCampaigns,
  dataStoreFiles,
  hayloArticles,
  type CityLocation,
  type InsertCityLocation,
  type ContentTemplate,
  type InsertContentTemplate,
  type CityContentAssignment,
  type InsertCityContentAssignment,
  type AdminUser,
  type InsertAdminUser,
  type AdminAuditLog,
  type InsertAdminAuditLog,
  type CustomPage,
  type InsertCustomPage,
  type PageSlide,
  type InsertPageSlide,
  type KnowledgeArticle,
  type InsertKnowledgeArticle,
  type KnowledgeArticleVersion,
  type InsertKnowledgeArticleVersion,
  type KnowledgeTemplate,
  type InsertKnowledgeTemplate,
  type KnowledgeCampaign,
  type InsertKnowledgeCampaign,
  type DataStoreFile,
  type InsertDataStoreFile,
  type HayloArticle,
  type InsertHayloArticle,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc, asc, gt, lt } from "drizzle-orm";

export interface IStorage {
  getCities(onlyPublished?: boolean): Promise<CityLocation[]>;
  getCityBySlug(slug: string): Promise<CityLocation | undefined>;
  getCityById(id: string): Promise<CityLocation | undefined>;
  createCity(city: InsertCityLocation): Promise<CityLocation>;
  updateCity(id: string, data: Partial<InsertCityLocation>): Promise<CityLocation | undefined>;
  deleteCity(id: string): Promise<void>;
  bulkUpdateCities(ids: string[], data: Partial<InsertCityLocation>): Promise<void>;

  getTemplates(onlyActive?: boolean): Promise<ContentTemplate[]>;
  getTemplateById(id: string): Promise<ContentTemplate | undefined>;
  createTemplate(template: InsertContentTemplate): Promise<ContentTemplate>;
  updateTemplate(id: string, data: Partial<InsertContentTemplate>): Promise<ContentTemplate | undefined>;

  getAssignmentByCityId(cityId: string): Promise<CityContentAssignment | undefined>;
  upsertAssignment(data: InsertCityContentAssignment): Promise<CityContentAssignment>;
  bulkAssignTemplate(cityIds: string[], templateId: string, assignedBy?: string): Promise<void>;

  getAdminByUsername(username: string): Promise<AdminUser | undefined>;
  getAdminById(id: string): Promise<AdminUser | undefined>;
  createAdmin(admin: InsertAdminUser): Promise<AdminUser>;
  adminExists(): Promise<boolean>;

  createAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog>;
  getAuditLogs(limit?: number): Promise<AdminAuditLog[]>;

  getPages(onlyPublished?: boolean): Promise<CustomPage[]>;
  getPageBySlug(slug: string): Promise<CustomPage | undefined>;
  getPageById(id: string): Promise<CustomPage | undefined>;
  createPage(page: InsertCustomPage): Promise<CustomPage>;
  updatePage(id: string, data: Partial<InsertCustomPage>): Promise<CustomPage | undefined>;
  deletePage(id: string): Promise<void>;

  getSlidesByPageId(pageId: string): Promise<PageSlide[]>;
  getSlideById(id: string): Promise<PageSlide | undefined>;
  createSlide(slide: InsertPageSlide): Promise<PageSlide>;
  updateSlide(id: string, data: Partial<InsertPageSlide>): Promise<PageSlide | undefined>;
  deleteSlide(id: string): Promise<void>;
  reorderSlides(pageId: string, slideId: string, direction: "up" | "down"): Promise<void>;

  getStats(): Promise<{
    totalCities: number;
    publishedCities: number;
    activeTemplates: number;
    assignedCities: number;
    totalPages: number;
    publishedPages: number;
    totalArticles: number;
    publishedArticles: number;
  }>;

  getKnowledgeArticles(status?: string): Promise<KnowledgeArticle[]>;
  getKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | undefined>;
  getKnowledgeArticleById(id: string): Promise<KnowledgeArticle | undefined>;
  createKnowledgeArticle(article: InsertKnowledgeArticle): Promise<KnowledgeArticle>;
  updateKnowledgeArticle(id: string, data: Partial<InsertKnowledgeArticle>): Promise<KnowledgeArticle | undefined>;
  deleteKnowledgeArticle(id: string): Promise<void>;
  publishKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined>;
  unpublishKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined>;
  archiveKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined>;
  unarchiveKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined>;
  getKnowledgeArticleVersions(articleId: string): Promise<KnowledgeArticleVersion[]>;

  getKnowledgeTemplates(): Promise<KnowledgeTemplate[]>;
  getKnowledgeTemplateById(id: string): Promise<KnowledgeTemplate | undefined>;
  createKnowledgeTemplate(data: InsertKnowledgeTemplate): Promise<KnowledgeTemplate>;
  updateKnowledgeTemplate(id: string, data: Partial<InsertKnowledgeTemplate>): Promise<KnowledgeTemplate | undefined>;
  deleteKnowledgeTemplate(id: string): Promise<void>;

  getPublishedArticlesByCitySlug(citySlug: string): Promise<KnowledgeArticle[]>;
  getCampaigns(): Promise<KnowledgeCampaign[]>;
  getCampaignById(id: string): Promise<KnowledgeCampaign | undefined>;
  createCampaign(data: InsertKnowledgeCampaign): Promise<KnowledgeCampaign>;
  updateCampaign(id: string, data: Partial<InsertKnowledgeCampaign>): Promise<KnowledgeCampaign | undefined>;
  deleteCampaign(id: string): Promise<void>;

  listHayloArticles(filters?: { status?: string; topicSlug?: string }): Promise<HayloArticle[]>;
  getHayloArticleById(id: string): Promise<HayloArticle | undefined>;
  getHayloArticleBySlug(slug: string): Promise<HayloArticle | undefined>;
  getHayloArticleByContentHash(hash: string): Promise<HayloArticle | undefined>;
  createHayloArticle(article: InsertHayloArticle, contentHash: string): Promise<HayloArticle>;
  updateHayloArticle(id: string, data: Partial<InsertHayloArticle>): Promise<HayloArticle | undefined>;
  deleteHayloArticle(id: string): Promise<void>;
  listHayloArticleTopics(): Promise<string[]>;

  getDataStoreFiles(status?: string, category?: string): Promise<DataStoreFile[]>;
  getDataStoreFileById(id: string): Promise<DataStoreFile | undefined>;
  createDataStoreFile(data: InsertDataStoreFile): Promise<DataStoreFile>;
  updateDataStoreFile(id: string, data: Partial<InsertDataStoreFile>): Promise<DataStoreFile | undefined>;
  deleteDataStoreFile(id: string): Promise<void>;
}

function extractImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height };
    }
    if (buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      if (buffer.toString("ascii", 12, 16) === "VP8 ") {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
    }
  } catch {}
  return null;
}

export class DatabaseStorage implements IStorage {
  async getCities(onlyPublished = false): Promise<CityLocation[]> {
    if (onlyPublished) {
      return db
        .select()
        .from(cityLocations)
        .where(eq(cityLocations.isPublished, true))
        .orderBy(asc(cityLocations.cityName));
    }
    return db.select().from(cityLocations).orderBy(asc(cityLocations.cityName));
  }

  async getCityBySlug(slug: string): Promise<CityLocation | undefined> {
    const [city] = await db
      .select()
      .from(cityLocations)
      .where(eq(cityLocations.slug, slug))
      .limit(1);
    return city;
  }

  async getCityById(id: string): Promise<CityLocation | undefined> {
    const [city] = await db
      .select()
      .from(cityLocations)
      .where(eq(cityLocations.id, id))
      .limit(1);
    return city;
  }

  async createCity(city: InsertCityLocation): Promise<CityLocation> {
    const [created] = await db.insert(cityLocations).values(city).returning();
    return created;
  }

  async updateCity(
    id: string,
    data: Partial<InsertCityLocation>
  ): Promise<CityLocation | undefined> {
    const [updated] = await db
      .update(cityLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cityLocations.id, id))
      .returning();
    return updated;
  }

  async deleteCity(id: string): Promise<void> {
    await db.delete(cityLocations).where(eq(cityLocations.id, id));
  }

  async bulkUpdateCities(
    ids: string[],
    data: Partial<InsertCityLocation>
  ): Promise<void> {
    await db
      .update(cityLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(inArray(cityLocations.id, ids));
  }

  async getTemplates(onlyActive = false): Promise<ContentTemplate[]> {
    if (onlyActive) {
      return db
        .select()
        .from(contentTemplates)
        .where(eq(contentTemplates.isActive, true))
        .orderBy(desc(contentTemplates.createdAt));
    }
    return db
      .select()
      .from(contentTemplates)
      .orderBy(desc(contentTemplates.createdAt));
  }

  async getTemplateById(id: string): Promise<ContentTemplate | undefined> {
    const [template] = await db
      .select()
      .from(contentTemplates)
      .where(eq(contentTemplates.id, id))
      .limit(1);
    return template;
  }

  async createTemplate(
    template: InsertContentTemplate
  ): Promise<ContentTemplate> {
    const [created] = await db
      .insert(contentTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateTemplate(
    id: string,
    data: Partial<InsertContentTemplate>
  ): Promise<ContentTemplate | undefined> {
    const [updated] = await db
      .update(contentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contentTemplates.id, id))
      .returning();
    return updated;
  }

  async getAssignmentByCityId(
    cityId: string
  ): Promise<CityContentAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(cityContentAssignments)
      .where(eq(cityContentAssignments.cityId, cityId))
      .limit(1);
    return assignment;
  }

  async upsertAssignment(
    data: InsertCityContentAssignment
  ): Promise<CityContentAssignment> {
    const existing = await this.getAssignmentByCityId(data.cityId);
    if (existing) {
      const [updated] = await db
        .update(cityContentAssignments)
        .set(data)
        .where(eq(cityContentAssignments.id, existing.id))
        .returning();
      await this.syncCityIndexingFromTemplate(data.cityId, data.templateId);
      return updated;
    }
    const [created] = await db
      .insert(cityContentAssignments)
      .values(data)
      .returning();
    await this.syncCityIndexingFromTemplate(data.cityId, data.templateId);
    return created;
  }

  private async syncCityIndexingFromTemplate(
    cityId: string,
    templateId: string | null | undefined
  ): Promise<void> {
    if (!templateId) return;
    const [tpl] = await db
      .select({ allowIndexing: contentTemplates.allowIndexing })
      .from(contentTemplates)
      .where(eq(contentTemplates.id, templateId))
      .limit(1);
    if (!tpl) return;
    await db
      .update(cityLocations)
      .set({ allowIndexing: tpl.allowIndexing, updatedAt: new Date() })
      .where(eq(cityLocations.id, cityId));
  }

  async bulkAssignTemplate(
    cityIds: string[],
    templateId: string,
    assignedBy?: string
  ): Promise<void> {
    for (const cityId of cityIds) {
      await this.upsertAssignment({
        cityId,
        templateId,
        assignedBy: assignedBy || null,
      });
    }
  }

  async getAdminByUsername(username: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);
    return admin;
  }

  async getAdminById(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    return admin;
  }

  async createAdmin(admin: InsertAdminUser): Promise<AdminUser> {
    const [created] = await db.insert(adminUsers).values(admin).returning();
    return created;
  }

  async adminExists(): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers);
    return Number(result.count) > 0;
  }

  async getStats() {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cityLocations);
    const [publishedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cityLocations)
      .where(eq(cityLocations.isPublished, true));
    const [templatesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contentTemplates)
      .where(eq(contentTemplates.isActive, true));
    const [assignedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cityContentAssignments);

    const [pagesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customPages);
    const [publishedPagesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customPages)
      .where(eq(customPages.isPublished, true));

    const [articlesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeArticles);
    const [publishedArticlesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.status, "published"));

    return {
      totalCities: Number(totalResult.count),
      publishedCities: Number(publishedResult.count),
      activeTemplates: Number(templatesResult.count),
      assignedCities: Number(assignedResult.count),
      totalPages: Number(pagesResult.count),
      publishedPages: Number(publishedPagesResult.count),
      totalArticles: Number(articlesResult.count),
      publishedArticles: Number(publishedArticlesResult.count),
    };
  }

  async createAuditLog(log: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [created] = await db.insert(adminAuditLog).values(log).returning();
    return created;
  }

  async getAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
  }

  async getPages(onlyPublished = false): Promise<CustomPage[]> {
    if (onlyPublished) {
      return db.select().from(customPages).where(eq(customPages.isPublished, true)).orderBy(asc(customPages.displayOrder));
    }
    return db.select().from(customPages).orderBy(asc(customPages.displayOrder));
  }

  async getPageBySlug(slug: string): Promise<CustomPage | undefined> {
    const [page] = await db.select().from(customPages).where(eq(customPages.slug, slug)).limit(1);
    return page;
  }

  async getPageById(id: string): Promise<CustomPage | undefined> {
    const [page] = await db.select().from(customPages).where(eq(customPages.id, id)).limit(1);
    return page;
  }

  async createPage(page: InsertCustomPage): Promise<CustomPage> {
    const [created] = await db.insert(customPages).values(page).returning();
    return created;
  }

  async updatePage(id: string, data: Partial<InsertCustomPage>): Promise<CustomPage | undefined> {
    const [updated] = await db.update(customPages).set({ ...data, updatedAt: new Date() }).where(eq(customPages.id, id)).returning();
    return updated;
  }

  async deletePage(id: string): Promise<void> {
    await db.delete(customPages).where(eq(customPages.id, id));
  }

  async getSlidesByPageId(pageId: string): Promise<PageSlide[]> {
    return db.select().from(pageSlides).where(eq(pageSlides.pageId, pageId)).orderBy(asc(pageSlides.slideOrder));
  }

  async getSlideById(id: string): Promise<PageSlide | undefined> {
    const [slide] = await db.select().from(pageSlides).where(eq(pageSlides.id, id)).limit(1);
    return slide;
  }

  async createSlide(slide: InsertPageSlide): Promise<PageSlide> {
    const [created] = await db.insert(pageSlides).values(slide).returning();
    return created;
  }

  async updateSlide(id: string, data: Partial<InsertPageSlide>): Promise<PageSlide | undefined> {
    const [updated] = await db.update(pageSlides).set({ ...data, updatedAt: new Date() }).where(eq(pageSlides.id, id)).returning();
    return updated;
  }

  async deleteSlide(id: string): Promise<void> {
    await db.delete(pageSlides).where(eq(pageSlides.id, id));
  }

  async reorderSlides(pageId: string, slideId: string, direction: "up" | "down"): Promise<void> {
    const slides = await this.getSlidesByPageId(pageId);
    const idx = slides.findIndex((s) => s.id === slideId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;
    const currentOrder = slides[idx].slideOrder;
    const swapOrder = slides[swapIdx].slideOrder;
    await db.update(pageSlides).set({ slideOrder: swapOrder, updatedAt: new Date() }).where(eq(pageSlides.id, slides[idx].id));
    await db.update(pageSlides).set({ slideOrder: currentOrder, updatedAt: new Date() }).where(eq(pageSlides.id, slides[swapIdx].id));
  }

  async getKnowledgeArticles(status?: string): Promise<KnowledgeArticle[]> {
    if (status) {
      return db.select().from(knowledgeArticles).where(eq(knowledgeArticles.status, status)).orderBy(desc(knowledgeArticles.updatedAt));
    }
    return db.select().from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt));
  }

  async getKnowledgeArticleBySlug(slug: string): Promise<KnowledgeArticle | undefined> {
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.slug, slug)).limit(1);
    return article;
  }

  async getKnowledgeArticleById(id: string): Promise<KnowledgeArticle | undefined> {
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id)).limit(1);
    return article;
  }

  async createKnowledgeArticle(article: InsertKnowledgeArticle): Promise<KnowledgeArticle> {
    const canonicalUrl = `https://www.tableicity.com/discovery/knowledge/${article.slug}`;
    const [created] = await db.insert(knowledgeArticles).values({ ...article, canonicalUrl }).returning();
    return created;
  }

  async updateKnowledgeArticle(id: string, data: Partial<InsertKnowledgeArticle>): Promise<KnowledgeArticle | undefined> {
    const updateData: any = { ...data, updatedAt: new Date(), dateModified: new Date() };
    if (data.slug) {
      updateData.canonicalUrl = `https://www.tableicity.com/discovery/knowledge/${data.slug}`;
    }
    const [updated] = await db.update(knowledgeArticles).set(updateData).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeArticle(id: string): Promise<void> {
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  }

  async publishKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined> {
    const article = await this.getKnowledgeArticleById(id);
    if (!article) return undefined;

    const [versionCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, id));
    const nextVersion = Number(versionCount.count) + 1;

    await db.insert(knowledgeArticleVersions).values({
      articleId: id,
      versionNumber: nextVersion,
      snapshotJson: JSON.parse(JSON.stringify(article)),
      snapshotReason: "publish",
      createdBy: username,
    });

    const now = new Date();
    const updateData: any = {
      status: "published",
      datePublished: article.datePublished || now,
      dateModified: now,
      updatedAt: now,
    };

    if (article.ogImageUrl && article.ogImageUrl.startsWith("https://")) {
      try {
        const imgRes = await fetch(article.ogImageUrl, { method: "GET", signal: AbortSignal.timeout(15000) });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get("content-type") || "";
          if (contentType.startsWith("image/")) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const dims = extractImageDimensions(buffer);
            if (dims) {
              updateData.imageWidth = dims.width;
              updateData.imageHeight = dims.height;
            }
          }
        }
      } catch {}
    }

    const [updated] = await db.update(knowledgeArticles).set(updateData).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async unpublishKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined> {
    const article = await this.getKnowledgeArticleById(id);
    if (!article) return undefined;

    const [versionCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, id));
    const nextVersion = Number(versionCount.count) + 1;

    await db.insert(knowledgeArticleVersions).values({
      articleId: id,
      versionNumber: nextVersion,
      snapshotJson: JSON.parse(JSON.stringify(article)),
      snapshotReason: "unpublish",
      createdBy: username,
    });

    const now = new Date();
    const [updated] = await db.update(knowledgeArticles).set({
      status: "pending",
      dateModified: now,
      updatedAt: now,
    }).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async archiveKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined> {
    const article = await this.getKnowledgeArticleById(id);
    if (!article) return undefined;

    const [versionCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, id));
    const nextVersion = Number(versionCount.count) + 1;

    await db.insert(knowledgeArticleVersions).values({
      articleId: id,
      versionNumber: nextVersion,
      snapshotJson: JSON.parse(JSON.stringify(article)),
      snapshotReason: "archive",
      createdBy: username,
    });

    const now = new Date();
    const [updated] = await db.update(knowledgeArticles).set({
      status: "archived",
      dateModified: now,
      updatedAt: now,
    }).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async unarchiveKnowledgeArticle(id: string, username: string): Promise<KnowledgeArticle | undefined> {
    const article = await this.getKnowledgeArticleById(id);
    if (!article || article.status !== "archived") return undefined;

    const [versionCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, id));
    const nextVersion = Number(versionCount.count) + 1;

    await db.insert(knowledgeArticleVersions).values({
      articleId: id,
      versionNumber: nextVersion,
      snapshotJson: JSON.parse(JSON.stringify(article)),
      snapshotReason: "unarchive",
      createdBy: username,
    });

    const now = new Date();
    const [updated] = await db.update(knowledgeArticles).set({
      status: "pending",
      dateModified: now,
      updatedAt: now,
    }).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }

  async getKnowledgeArticleVersions(articleId: string): Promise<KnowledgeArticleVersion[]> {
    return db.select().from(knowledgeArticleVersions).where(eq(knowledgeArticleVersions.articleId, articleId)).orderBy(desc(knowledgeArticleVersions.versionNumber));
  }

  async getKnowledgeTemplates(): Promise<KnowledgeTemplate[]> {
    return db.select().from(knowledgeTemplates).orderBy(desc(knowledgeTemplates.createdAt));
  }

  async getKnowledgeTemplateById(id: string): Promise<KnowledgeTemplate | undefined> {
    const [t] = await db.select().from(knowledgeTemplates).where(eq(knowledgeTemplates.id, id));
    return t;
  }

  async createKnowledgeTemplate(data: InsertKnowledgeTemplate): Promise<KnowledgeTemplate> {
    const [t] = await db.insert(knowledgeTemplates).values(data).returning();
    return t;
  }

  async updateKnowledgeTemplate(id: string, data: Partial<InsertKnowledgeTemplate>): Promise<KnowledgeTemplate | undefined> {
    const now = new Date();
    const [t] = await db.update(knowledgeTemplates).set({ ...data, updatedAt: now }).where(eq(knowledgeTemplates.id, id)).returning();
    return t;
  }

  async deleteKnowledgeTemplate(id: string): Promise<void> {
    await db.delete(knowledgeTemplates).where(eq(knowledgeTemplates.id, id));
  }

  async getDataStoreFiles(status?: string, category?: string): Promise<DataStoreFile[]> {
    const conditions = [];
    if (status) conditions.push(eq(dataStoreFiles.status, status));
    if (category) conditions.push(eq(dataStoreFiles.category, category));
    if (conditions.length > 0) {
      return db.select().from(dataStoreFiles).where(and(...conditions)).orderBy(desc(dataStoreFiles.createdAt));
    }
    return db.select().from(dataStoreFiles).orderBy(desc(dataStoreFiles.createdAt));
  }

  async getDataStoreFileById(id: string): Promise<DataStoreFile | undefined> {
    const [f] = await db.select().from(dataStoreFiles).where(eq(dataStoreFiles.id, id));
    return f;
  }

  async createDataStoreFile(data: InsertDataStoreFile): Promise<DataStoreFile> {
    const [f] = await db.insert(dataStoreFiles).values(data).returning();
    return f;
  }

  async updateDataStoreFile(id: string, data: Partial<InsertDataStoreFile>): Promise<DataStoreFile | undefined> {
    const now = new Date();
    const [f] = await db.update(dataStoreFiles).set({ ...data, updatedAt: now }).where(eq(dataStoreFiles.id, id)).returning();
    return f;
  }

  async deleteDataStoreFile(id: string): Promise<void> {
    await db.delete(dataStoreFiles).where(eq(dataStoreFiles.id, id));
  }

  async getPublishedArticlesByCitySlug(citySlug: string): Promise<KnowledgeArticle[]> {
    return db.select().from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.citySlug, citySlug), eq(knowledgeArticles.status, "published")))
      .orderBy(desc(knowledgeArticles.datePublished));
  }

  async getCampaigns(): Promise<KnowledgeCampaign[]> {
    return db.select().from(knowledgeCampaigns).orderBy(desc(knowledgeCampaigns.createdAt));
  }

  async getCampaignById(id: string): Promise<KnowledgeCampaign | undefined> {
    const [c] = await db.select().from(knowledgeCampaigns).where(eq(knowledgeCampaigns.id, id)).limit(1);
    return c;
  }

  async createCampaign(data: InsertKnowledgeCampaign): Promise<KnowledgeCampaign> {
    const [c] = await db.insert(knowledgeCampaigns).values(data).returning();
    return c;
  }

  async updateCampaign(id: string, data: Partial<InsertKnowledgeCampaign>): Promise<KnowledgeCampaign | undefined> {
    const now = new Date();
    const [c] = await db.update(knowledgeCampaigns).set({ ...data, updatedAt: now }).where(eq(knowledgeCampaigns.id, id)).returning();
    return c;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.campaignId, id));
    await db.delete(knowledgeCampaigns).where(eq(knowledgeCampaigns.id, id));
  }

  async listHayloArticles(filters?: { status?: string; topicSlug?: string }): Promise<HayloArticle[]> {
    const where = [] as any[];
    if (filters?.status) where.push(eq(hayloArticles.status, filters.status));
    if (filters?.topicSlug) where.push(eq(hayloArticles.topicSlug, filters.topicSlug));
    const q = db.select().from(hayloArticles).orderBy(desc(hayloArticles.updatedAt));
    if (where.length === 0) return q;
    return q.where(where.length === 1 ? where[0] : and(...where));
  }

  async getHayloArticleById(id: string): Promise<HayloArticle | undefined> {
    const [row] = await db.select().from(hayloArticles).where(eq(hayloArticles.id, id)).limit(1);
    return row;
  }

  async getHayloArticleBySlug(slug: string): Promise<HayloArticle | undefined> {
    const [row] = await db.select().from(hayloArticles).where(eq(hayloArticles.slug, slug)).limit(1);
    return row;
  }

  async getHayloArticleByContentHash(hash: string): Promise<HayloArticle | undefined> {
    const [row] = await db.select().from(hayloArticles).where(eq(hayloArticles.contentHash, hash)).limit(1);
    return row;
  }

  async createHayloArticle(article: InsertHayloArticle, contentHash: string): Promise<HayloArticle> {
    const [created] = await db.insert(hayloArticles).values({ ...article, contentHash }).returning();
    return created;
  }

  async updateHayloArticle(id: string, data: Partial<InsertHayloArticle>): Promise<HayloArticle | undefined> {
    const [updated] = await db.update(hayloArticles).set({ ...data, updatedAt: new Date() }).where(eq(hayloArticles.id, id)).returning();
    return updated;
  }

  async deleteHayloArticle(id: string): Promise<void> {
    await db.delete(hayloArticles).where(eq(hayloArticles.id, id));
  }

  async listHayloArticleTopics(): Promise<string[]> {
    const rows = await db.selectDistinct({ topicSlug: hayloArticles.topicSlug }).from(hayloArticles).orderBy(asc(hayloArticles.topicSlug));
    return rows.map((r) => r.topicSlug);
  }
}

export const storage = new DatabaseStorage();

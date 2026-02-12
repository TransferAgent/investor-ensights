import {
  cityLocations,
  contentTemplates,
  cityContentAssignments,
  adminUsers,
  adminAuditLog,
  customPages,
  pageSlides,
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
  }>;
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
      return updated;
    }
    const [created] = await db
      .insert(cityContentAssignments)
      .values(data)
      .returning();
    return created;
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

    return {
      totalCities: Number(totalResult.count),
      publishedCities: Number(publishedResult.count),
      activeTemplates: Number(templatesResult.count),
      assignedCities: Number(assignedResult.count),
      totalPages: Number(pagesResult.count),
      publishedPages: Number(publishedPagesResult.count),
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
}

export const storage = new DatabaseStorage();

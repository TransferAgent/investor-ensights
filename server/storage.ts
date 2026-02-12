import {
  cityLocations,
  contentTemplates,
  cityContentAssignments,
  adminUsers,
  type CityLocation,
  type InsertCityLocation,
  type ContentTemplate,
  type InsertContentTemplate,
  type CityContentAssignment,
  type InsertCityContentAssignment,
  type AdminUser,
  type InsertAdminUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, ilike, desc, asc } from "drizzle-orm";

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

  getStats(): Promise<{
    totalCities: number;
    publishedCities: number;
    activeTemplates: number;
    assignedCities: number;
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

    return {
      totalCities: Number(totalResult.count),
      publishedCities: Number(publishedResult.count),
      activeTemplates: Number(templatesResult.count),
      assignedCities: Number(assignedResult.count),
    };
  }
}

export const storage = new DatabaseStorage();

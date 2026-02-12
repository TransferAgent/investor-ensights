import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  decimal,
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
    metaDescription: varchar("meta_description", { length: 300 }),
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
    metaDescriptionPattern: varchar("meta_description_pattern", { length: 300 }),
    h1HeaderPattern: varchar("h1_header_pattern", { length: 255 }),
    h2SubheaderPattern: varchar("h2_subheader_pattern", { length: 255 }),
    bodyContentPattern: text("body_content_pattern"),
    ctaText: varchar("cta_text", { length: 100 }),
    ctaUrlPattern: varchar("cta_url_pattern", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
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

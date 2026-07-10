import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Regions table for managing different areas
export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Item Types table for managing inventory item categories
export const ITEM_TYPE_CATEGORIES = ["devices", "papers", "sim", "accessories"] as const;
export const itemTypeCategorySchema = z.enum(ITEM_TYPE_CATEGORIES);

export const itemTypes = pgTable("item_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category").notNull(),
  unitsPerBox: integer("units_per_box").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  icon: text("icon"),
  color: text("color"),
  serialPrefix: text("serial_prefix"),
  serialLength: integer("serial_length"),
  serialRegex: text("serial_regex"),
  requiresSerial: boolean("requires_serial").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueNameArIdx: uniqueIndex("item_types_name_ar_unique").on(table.nameAr),
  uniqueNameEnIdx: uniqueIndex("item_types_name_en_unique").on(table.nameEn),
}));

export const insertRegionSchema = createInsertSchema(regions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const baseInsertItemTypeSchema = createInsertSchema(itemTypes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertItemTypeSchema = baseInsertItemTypeSchema.extend({
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  category: itemTypeCategorySchema,
  unitsPerBox: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative().optional(),
  serialPrefix: z.string().nullable().optional(),
  serialLength: z.number().int().nonnegative().nullable().optional(),
  serialRegex: z.string().nullable().optional(),
  requiresSerial: z.boolean().optional(),
});

export type InsertRegion = z.infer<typeof insertRegionSchema>;
export type Region = typeof regions.$inferSelect;
export type InsertItemType = z.infer<typeof insertItemTypeSchema>;
export type ItemType = typeof itemTypes.$inferSelect;

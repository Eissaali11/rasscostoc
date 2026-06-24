/**
 * Item Types routes
 */

import type { Express } from "express";
import { itemTypesController } from "../controllers/item-types.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { z } from "zod";

const createItemTypeSchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  category: z.enum(["devices", "papers", "sim", "accessories"]),
  unitsPerBox: z.number().int().positive(),
  isActive: z.boolean().optional().default(true),
  isVisible: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const updateItemTypeSchema = z.object({
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  category: z.enum(["devices", "papers", "sim", "accessories"]).optional(),
  unitsPerBox: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const toggleActiveSchema = z.object({
  isActive: z.boolean(),
});

const toggleVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

export function registerItemTypesRoutes(app: Express): void {
  // Get all item types
  app.get("/api/item-types", requireAuth, itemTypesController.getAll);

  // Get active item types only
  app.get("/api/item-types/active", requireAuth, itemTypesController.getActive);

  // Get serial tracking rows for one item type
  app.get(
    "/api/item-types/:id/serial-tracking",
    requireAuth,
    itemTypesController.getSerialTracking
  );

  // Get single item type
  app.get("/api/item-types/:id", requireAuth, itemTypesController.getById);

  // Create new item type
  app.post(
    "/api/item-types",
    requireAuth,
    requireAdmin,
    validateBody(createItemTypeSchema),
    itemTypesController.create
  );

  // Update item type
  app.patch(
    "/api/item-types/:id",
    requireAuth,
    requireAdmin,
    validateBody(updateItemTypeSchema),
    itemTypesController.update
  );

  // Toggle item type active status
  app.patch(
    "/api/item-types/:id/toggle-active",
    requireAuth,
    requireAdmin,
    validateBody(toggleActiveSchema),
    itemTypesController.toggleActive
  );

  // Toggle item type visibility
  app.patch(
    "/api/item-types/:id/toggle-visibility",
    requireAuth,
    requireAdmin,
    validateBody(toggleVisibilitySchema),
    itemTypesController.toggleVisibility
  );

  // Delete item type
  app.delete(
    "/api/item-types/:id",
    requireAuth,
    requireAdmin,
    itemTypesController.delete
  );

}

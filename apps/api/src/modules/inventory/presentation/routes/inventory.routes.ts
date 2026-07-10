/**
 * Inventory routes
 */

import type { Express } from "express";
import { inventoryContainer } from "@server/composition/inventory.container";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody, validateParams } from "@core/middlewares/validation";
import { insertInventoryItemSchema } from "@shared/schema";
import { z } from "zod";

const addStockSchema = z.object({
  quantity: z.number().positive(),
  reason: z.string().optional(),
});

const withdrawStockSchema = z.object({
  quantity: z.number().positive(),
  reason: z.string().optional(),
});

export function registerInventoryRoutes(app: Express): void {
  const controller = inventoryContainer.inventoryController;

  // Get all inventory items
  app.get("/api/inventory", requireAuth, controller.getAll);

  // Get single inventory item
  app.get("/api/inventory/:id", requireAuth, controller.getById);

  // Create new inventory item
  app.post(
    "/api/inventory",
    requireAuth,
    validateBody(insertInventoryItemSchema),
    controller.create
  );

  // Update inventory item
  app.patch(
    "/api/inventory/:id",
    requireAuth,
    validateBody(insertInventoryItemSchema.partial()),
    controller.update
  );

  // Delete inventory item
  app.delete(
    "/api/inventory/:id",
    requireAuth,
    requireAdmin,
    controller.delete
  );

  // Add stock
  app.post(
    "/api/inventory/:id/add",
    requireAuth,
    validateBody(addStockSchema),
    controller.addStock
  );

  // Withdraw stock
  app.post(
    "/api/inventory/:id/withdraw",
    requireAuth,
    validateBody(withdrawStockSchema),
    controller.withdrawStock
  );
}

/**
 * Inventory routes
 */

import type { Express } from "express";
import { inventoryController } from "../controllers/inventory.controller";
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
  // Get all inventory items
  app.get("/api/inventory", inventoryController.getAll);

  // Get single inventory item
  app.get("/api/inventory/:id", inventoryController.getById);

  // Create new inventory item
  app.post(
    "/api/inventory",
    requireAuth,
    validateBody(insertInventoryItemSchema),
    inventoryController.create
  );

  // Update inventory item
  app.patch(
    "/api/inventory/:id",
    requireAuth,
    validateBody(insertInventoryItemSchema.partial()),
    inventoryController.update
  );

  // Delete inventory item
  app.delete(
    "/api/inventory/:id",
    requireAuth,
    requireAdmin,
    inventoryController.delete
  );

  // Add stock
  app.post(
    "/api/inventory/:id/add",
    requireAuth,
    validateBody(addStockSchema),
    inventoryController.addStock
  );

  // Withdraw stock
  app.post(
    "/api/inventory/:id/withdraw",
    requireAuth,
    validateBody(withdrawStockSchema),
    inventoryController.withdrawStock
  );
}

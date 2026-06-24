/**
 * Warehouses routes
 */

import type { Express } from "express";
import { warehousesController } from "../controllers/warehouses.controller";
import { requireAuth, requireAdmin, requireSupervisor } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { insertWarehouseSchema } from "@shared/schema";
import { z } from "zod";

const inventoryEntrySchema = z.object({
  itemTypeId: z.string(),
  boxes: z.number().min(0),
  units: z.number().min(0),
});

export function registerWarehousesRoutes(app: Express): void {
  // Get all warehouses (admin)
  app.get(
    "/api/warehouses",
    requireAuth,
    requireAdmin,
    warehousesController.getAll
  );

  // Get supervisor warehouses
  app.get(
    "/api/supervisor/warehouses",
    requireAuth,
    requireSupervisor,
    warehousesController.getSupervisorWarehouses
  );

  // Get single warehouse
  app.get(
    "/api/warehouses/:id",
    requireAuth,
    requireSupervisor,
    warehousesController.getById
  );

  // Create warehouse
  app.post(
    "/api/warehouses",
    requireAuth,
    requireAdmin,
    validateBody(insertWarehouseSchema),
    warehousesController.create
  );

  // Update warehouse
  app.put(
    "/api/warehouses/:id",
    requireAuth,
    requireAdmin,
    validateBody(insertWarehouseSchema.partial()),
    warehousesController.update
  );

  // Delete warehouse
  app.delete(
    "/api/warehouses/:id",
    requireAuth,
    requireAdmin,
    warehousesController.delete
  );

  // Get warehouse inventory
  app.get(
    "/api/warehouse-inventory/:warehouseId",
    requireAuth,
    requireSupervisor,
    warehousesController.getInventory
  );

  // Update warehouse inventory
  app.put(
    "/api/warehouse-inventory/:warehouseId",
    requireAuth,
    requireSupervisor,
    warehousesController.updateInventory
  );

  // Get warehouse inventory entries
  app.get(
    "/api/warehouses/:warehouseId/inventory-entries",
    requireAuth,
    warehousesController.getInventoryEntries
  );

  // Upsert warehouse inventory entry
  app.post(
    "/api/warehouses/:warehouseId/inventory-entries",
    requireAuth,
    validateBody(inventoryEntrySchema),
    warehousesController.upsertInventoryEntry
  );
}

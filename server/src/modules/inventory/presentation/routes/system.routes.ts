/**
 * System routes (logs, backup, etc.)
 */

import type { Express } from "express";
import { systemController } from "../controllers/system.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { z } from "zod";

const restoreBackupSchema = z.object({
  version: z.string().optional(),
  timestamp: z.string().optional(),
  data: z.object({
    regions: z.array(z.any()).optional(),
    users: z.array(z.any()).optional(),
    inventoryItems: z.array(z.any()).optional(),
    transactions: z.array(z.any()).optional(),
    warehouses: z.array(z.any()).optional(),
    warehouseInventory: z.array(z.any()).optional(),
    warehouseInventoryEntries: z.array(z.any()).optional(),
    supervisorWarehouses: z.array(z.any()).optional(),
    techniciansInventory: z.array(z.any()).optional(),
    technicianFixedInventories: z.array(z.any()).optional(),
    inventoryRequests: z.array(z.any()).optional(),
    warehouseTransfers: z.array(z.any()).optional(),
    stockMovements: z.array(z.any()).optional(),
    receivedDevices: z.array(z.any()).optional(),
    systemLogs: z.array(z.any()).optional(),
    itemTypes: z.array(z.any()).optional(),
    withdrawnDevices: z.array(z.any()).optional(),
  }),
});

export function registerSystemRoutes(app: Express): void {
  // Get system logs
  app.get("/api/system-logs", requireAuth, systemController.getLogs);

  // Create backup
  app.get("/api/admin/backup", requireAuth, requireAdmin, systemController.createBackup);

  // Get backup storage stats
  app.get("/api/admin/backup/storage-stats", requireAuth, requireAdmin, systemController.getBackupStorageStats);

  // Get backup history
  app.get("/api/admin/backup/history", requireAuth, requireAdmin, systemController.getBackupHistory);

  // Restore backup
  app.post(
    "/api/admin/restore",
    requireAuth,
    requireAdmin,
    validateBody(restoreBackupSchema),
    systemController.restoreBackup
  );
}

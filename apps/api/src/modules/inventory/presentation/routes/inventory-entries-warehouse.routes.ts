import type { Express } from "express";

/**
 * OPS-PERM-S1-F1.R2-SR2 Defect D: Neutralized duplicate route registration.
 *
 * The routes `/api/warehouses/:warehouseId/inventory-entries` (GET/POST)
 * are now registered and protected via warehouses.routes.ts and the
 * WarehousesController's getInventoryEntries and upsertInventoryEntry
 * methods, which enforce warehouse-scope authorization.
 *
 * This file previously registered the same routes with inline handlers
 * that bypassed authorization. To prevent route shadowing and ensure only
 * the protected variants are reachable, this function is now a no-op.
 */
export function registerWarehouseInventoryEntriesRoutes(_app: Express): void {
  // Intentionally empty: routes are now registered via warehouses.routes.ts
  // with proper authorization guards in place.
}

import type { Express } from "express";
import { registerInventoryRoutes } from "@modules/inventory/presentation/routes/inventory.routes";
import { registerTransactionsRoutes } from "@modules/inventory/presentation/routes/transactions.routes";
import { registerWarehousesRoutes } from "@modules/inventory/presentation/routes/warehouses.routes";
import { registerDevicesRoutes } from "@modules/inventory/presentation/routes/devices.routes";
import { registerWarehouseTransferOperationsRoutes } from "@modules/inventory/presentation/routes/warehouse-transfer-operations.routes";
import { registerWarehouseStockMovementRoutes } from "@modules/inventory/presentation/routes/warehouse-stock-movements.routes";
import { registerWarehouseBatchOperationsRoutes } from "@modules/inventory/presentation/routes/warehouse-batch-operations.routes";
import { registerWarehouseTransferAdminRoutes } from "@modules/inventory/presentation/routes/warehouse-transfer-admin.routes";
import { registerInventoryRequestsManagementRoutes } from "@modules/inventory/presentation/routes/inventory-requests-management.routes";
import { registerInventoryRequestsApprovalRoutes } from "@modules/inventory/presentation/routes/inventory-requests-approval.routes";
import { registerWarehouseInventoryEntriesRoutes } from "@modules/inventory/presentation/routes/inventory-entries-warehouse.routes";
import { registerTechnicianInventoryEntriesRoutes } from "@modules/inventory/presentation/routes/inventory-entries-technician.routes";
import { registerInventoryEntriesMigrationRoutes } from "@modules/inventory/presentation/routes/inventory-entries-migration.routes";
import { registerTechniciansAdminRoutes } from "@modules/inventory/presentation/routes/technicians-admin.routes";
import { registerInventoryScanRoutes } from "@modules/inventory/presentation/routes/inventory-scan.routes";
import { registerSerializedItemsRoutes } from "@modules/inventory/presentation/routes/serialized-items.routes";
import { registerAccountingRoutes } from "@modules/accounting/presentation/routes/accounting.routes";

/**
 * Common/System Routes
 * Shared operational routes across roles
 */
export function registerCommonRoleRoutes(app: Express): void {
  registerInventoryRoutes(app);
  registerTransactionsRoutes(app);
  registerWarehousesRoutes(app);
  registerDevicesRoutes(app);

  registerWarehouseTransferOperationsRoutes(app);
  registerWarehouseTransferAdminRoutes(app);
  registerWarehouseStockMovementRoutes(app);
  registerWarehouseBatchOperationsRoutes(app);

  registerInventoryRequestsManagementRoutes(app);
  registerInventoryRequestsApprovalRoutes(app);
  registerWarehouseInventoryEntriesRoutes(app);
  registerTechnicianInventoryEntriesRoutes(app);
  registerInventoryEntriesMigrationRoutes(app);
  registerInventoryScanRoutes(app);
  registerSerializedItemsRoutes(app);
  registerAccountingRoutes(app);

  registerTechniciansAdminRoutes(app);
}


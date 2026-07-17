import { getDatabase } from "@core/database/connection";
import {
  inventoryItems,
  itemTypes,
  regions,
  supervisorWarehouses,
  transactions,
  inventoryRequests,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouseTransfers,
  warehouses,
} from "@shared/schema";
import { getInventoryIdentityPorts } from "../../adapters/identity/identity-ports.registry";

export class ExportSystemBackupUseCase {
  async execute(): Promise<{ exportedAt: string; data: Record<string, unknown> }> {
    const db = getDatabase();

    const [
      allUsers,
      allRegions,
      allItemTypes,
      allItems,
      allTransactions,
      allWarehouses,
      allWarehouseInventory,
      allWarehouseInventoryEntries,
      allSupervisorWarehouses,
      allInventoryRequests,
      allWarehouseTransfers,
    ] = await Promise.all([
      getInventoryIdentityPorts().getAllUsersForBackup(),
      db.select().from(regions),
      db.select().from(itemTypes),
      db.select().from(inventoryItems),
      db.select().from(transactions),
      db.select().from(warehouses),
      db.select().from(warehouseInventory),
      db.select().from(warehouseInventoryEntries),
      db.select().from(supervisorWarehouses),
      db.select().from(inventoryRequests),
      db.select().from(warehouseTransfers),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      data: {
        users: allUsers,
        regions: allRegions,
        itemTypes: allItemTypes,
        inventoryItems: allItems,
        transactions: allTransactions,
        warehouses: allWarehouses,
        warehouseInventory: allWarehouseInventory,
        warehouseInventoryEntries: allWarehouseInventoryEntries,
        supervisorWarehouses: allSupervisorWarehouses,
        inventoryRequests: allInventoryRequests,
        warehouseTransfers: allWarehouseTransfers,
      },
    };
  }
}

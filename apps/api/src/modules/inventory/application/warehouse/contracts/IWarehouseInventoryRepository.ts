import type {
  WarehouseInventoryEntry,
  InsertWarehouseInventoryEntry,
} from "@shared/schema";

export interface IWarehouseInventoryRepository {
  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  createWarehouseInventoryEntry(entry: InsertWarehouseInventoryEntry): Promise<WarehouseInventoryEntry>;
  updateWarehouseInventoryEntry(id: string, updates: Partial<InsertWarehouseInventoryEntry>): Promise<WarehouseInventoryEntry>;
  deleteWarehouseInventoryEntry(id: string): Promise<boolean>;
  upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<WarehouseInventoryEntry>;
}

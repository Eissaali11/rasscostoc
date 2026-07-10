import type {
  Warehouse,
  WarehouseInventory,
  WarehouseTransfer,
  WarehouseInventoryEntry,
  InsertWarehouse,
  InsertWarehouseInventory,
  InsertWarehouseTransfer,
  WarehouseWithStats,
  WarehouseWithInventory,
  WarehouseTransferWithDetails
} from "@shared/schema";

export interface IWarehouseRepository {
  getWarehouses(): Promise<WarehouseWithStats[]>;
  getWarehouse(id: string): Promise<WarehouseWithInventory | undefined>;
  createWarehouse(insertWarehouse: InsertWarehouse, createdBy: string): Promise<Warehouse>;
  updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse>;
  deleteWarehouse(id: string): Promise<boolean>;
  getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | undefined>;
  updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory>;
  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  upsertWarehouseInventoryEntry(
    warehouseId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<WarehouseInventoryEntry>;
  getWarehouseTransfers(
    warehouseId?: string, 
    technicianId?: string, 
    regionId?: string, 
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]>;
  createWarehouseTransfer(data: InsertWarehouseTransfer): Promise<WarehouseTransfer>;
  updateWarehouseTransferStatus(id: string, status: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(id: string, reason?: string): Promise<WarehouseTransfer>;
  getWarehousesByRegion(regionId: string): Promise<Warehouse[]>;
  getActiveWarehouses(): Promise<Warehouse[]>;
  searchWarehouses(query: string): Promise<WarehouseWithStats[]>;
}

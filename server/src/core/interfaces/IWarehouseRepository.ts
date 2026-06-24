import {
  Warehouse,
  InsertWarehouse,
  WarehouseInventory,
  InsertWarehouseInventory,
  WarehouseWithInventory,
  WarehouseWithStats,
  WarehouseTransfer,
  InsertWarehouseTransfer,
  WarehouseTransferWithDetails,
  InventoryRequest,
  InsertInventoryRequest,
  WarehouseInventoryEntry,
  InsertWarehouseInventoryEntry
} from "@shared/schema";

/**
 * Warehouse Repository Interface
 * Defines contract for warehouse data operations
 */
export interface IWarehouseRepository {
  // Basic warehouse operations
  getWarehouses(): Promise<WarehouseWithStats[]>;
  getWarehouse(id: string): Promise<WarehouseWithInventory | undefined>;
  createWarehouse(insertWarehouse: InsertWarehouse, createdBy: string): Promise<Warehouse>;
  updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse>;
  deleteWarehouse(id: string): Promise<boolean>;

  // Warehouse filtering and grouping
  getWarehousesByRegion(regionId: string): Promise<WarehouseWithStats[]>;
  getWarehousesBySupervisor(supervisorId: string): Promise<WarehouseWithStats[]>;

  // Warehouse inventory management
  getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | null>;
  updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory>;
  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<WarehouseInventoryEntry>;

  // Warehouse transfers
  createWarehouseTransfer(insertTransfer: InsertWarehouseTransfer): Promise<WarehouseTransfer>;
  getWarehouseTransfers(warehouseId?: string): Promise<WarehouseTransferWithDetails[]>;
  approveWarehouseTransfer(transferId: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(transferId: string, reason: string): Promise<WarehouseTransfer>;

  // Inventory requests
  createInventoryRequest(insertRequest: InsertInventoryRequest): Promise<InventoryRequest>;
  getInventoryRequests(technicianId?: string): Promise<InventoryRequest[]>;
  approveInventoryRequest(requestId: string, respondedBy: string): Promise<InventoryRequest>;
  rejectInventoryRequest(requestId: string, reason: string, respondedBy: string): Promise<InventoryRequest>;
}
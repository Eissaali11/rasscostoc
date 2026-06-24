import { 
  WarehouseInventoryEntry,
  InsertWarehouseInventoryEntry,
  TechnicianMovingInventoryEntry,
  InsertTechnicianMovingInventoryEntry,
  TechnicianInventory,
  InsertTechnicianInventory,
  InventoryRequest,
  InsertInventoryRequest
} from "@shared/schema";

export interface IInventoryRepository {
  // Warehouse Inventory Entries (New System)
  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  createWarehouseInventoryEntry(entry: InsertWarehouseInventoryEntry): Promise<WarehouseInventoryEntry>;
  updateWarehouseInventoryEntry(id: string, updates: Partial<InsertWarehouseInventoryEntry>): Promise<WarehouseInventoryEntry>;
  deleteWarehouseInventoryEntry(id: string): Promise<boolean>;

  // Technician Moving Inventory Entries (New System)
  getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]>;
  createTechnicianMovingInventoryEntry(entry: InsertTechnicianMovingInventoryEntry): Promise<TechnicianMovingInventoryEntry>;
  updateTechnicianMovingInventoryEntry(id: string, updates: Partial<InsertTechnicianMovingInventoryEntry>): Promise<TechnicianMovingInventoryEntry>;
  deleteTechnicianMovingInventoryEntry(id: string): Promise<boolean>;

  // Legacy Technicians Inventory (Backward Compatibility)
  getTechnicianInventory(technicianId: string): Promise<TechnicianInventory | undefined>;
  updateTechnicianInventory(technicianId: string, updates: Partial<InsertTechnicianInventory>): Promise<TechnicianInventory>;

  // Inventory Requests
  getInventoryRequests(warehouseId?: string, technicianId?: string, status?: string): Promise<InventoryRequest[]>;
  createInventoryRequest(request: InsertInventoryRequest): Promise<InventoryRequest>;
  updateInventoryRequest(id: string, updates: Partial<InsertInventoryRequest>): Promise<InventoryRequest>;
  deleteInventoryRequest(id: string): Promise<boolean>;
}
import {
  type InventoryItem,
  type InsertInventoryItem,
  type Transaction,
  type InsertTransaction,
  type InventoryItemWithStatus,
  type DashboardStats,
  type Region,
  type InsertRegion,
  type User,
  type InsertUser,
  type UserSafe,
  type RegionWithStats,
  type AdminStats,
  type TransactionWithDetails,
  type WithdrawnDevice,
  type InsertWithdrawnDevice,
  type ReceivedDevice,
  type InsertReceivedDevice,
  type TechnicianFixedInventory,
  type InsertTechnicianFixedInventory,
  type StockMovement,
  type InsertStockMovement,
  type TechnicianWithFixedInventory,
  type FixedInventorySummary,
  type StockMovementWithDetails,
  type Warehouse,
  type WarehouseInventory,
  type WarehouseTransfer,
  type InsertWarehouse,
  type InsertWarehouseInventory,
  type InsertWarehouseTransfer,
  type WarehouseWithStats,
  type WarehouseWithInventory,
  type WarehouseTransferWithDetails,
  type SupervisorTechnician,
  type SupervisorWarehouse,
  type SystemLog,
  type InsertSystemLog,
  type ItemType,
  type InsertItemType,
  type WarehouseInventoryEntry,
  type TechnicianFixedInventoryEntry,
  type TechnicianMovingInventoryEntry,
} from '@shared/schema';

export interface IStorage {
  getInventoryItems(): Promise<InventoryItemWithStatus[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<boolean>;

  getRegions(): Promise<RegionWithStats[]>;
  getRegion(id: string): Promise<Region | undefined>;
  createRegion(region: InsertRegion): Promise<Region>;
  updateRegion(id: string, updates: Partial<InsertRegion>): Promise<Region>;
  deleteRegion(id: string): Promise<boolean>;

  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe>;
  deleteUser(id: string): Promise<boolean>;

  getTransactions(filters?: {
    page?: number;
    limit?: number;
    type?: string;
    userId?: string;
    regionId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{
    transactions: TransactionWithDetails[];
    total: number;
    page: number;
    totalPages: number;
  }>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]>;

  getDashboardStats(): Promise<DashboardStats>;
  getAdminStats(): Promise<AdminStats>;

  addStock(itemId: string, quantity: number, reason?: string, userId?: string): Promise<InventoryItem>;
  withdrawStock(itemId: string, quantity: number, reason?: string, userId?: string): Promise<InventoryItem>;

  getWithdrawnDevices(): Promise<WithdrawnDevice[]>;
  getWithdrawnDevice(id: string): Promise<WithdrawnDevice | undefined>;
  createWithdrawnDevice(device: InsertWithdrawnDevice): Promise<WithdrawnDevice>;
  updateWithdrawnDevice(id: string, updates: Partial<InsertWithdrawnDevice>): Promise<WithdrawnDevice>;
  deleteWithdrawnDevice(id: string): Promise<boolean>;

  getReceivedDevices(filters?: { status?: string; technicianId?: string; supervisorId?: string; regionId?: string }): Promise<ReceivedDevice[]>;
  getReceivedDevice(id: string): Promise<ReceivedDevice | undefined>;
  createReceivedDevice(device: InsertReceivedDevice): Promise<ReceivedDevice>;
  updateReceivedDeviceStatus(id: string, status: string, respondedBy: string, adminNotes?: string): Promise<ReceivedDevice>;
  deleteReceivedDevice(id: string): Promise<boolean>;
  getPendingReceivedDevicesCount(supervisorId?: string, regionId?: string | null): Promise<number>;

  getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined>;
  createTechnicianFixedInventory(inventory: InsertTechnicianFixedInventory): Promise<TechnicianFixedInventory>;
  updateTechnicianFixedInventory(technicianId: string, updates: Partial<InsertTechnicianFixedInventory>): Promise<TechnicianFixedInventory>;
  deleteTechnicianFixedInventory(technicianId: string): Promise<void>;
  getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]>;
  getFixedInventorySummary(): Promise<FixedInventorySummary>;
  getAllTechniciansWithBothInventories(): Promise<any[]>;
  getRegionTechniciansWithInventories(regionId: string): Promise<any[]>;

  createStockMovement(movement: InsertStockMovement): Promise<StockMovement>;
  getStockMovements(technicianId?: string, limit?: number): Promise<StockMovementWithDetails[]>;
  transferStock(params: {
    technicianId: string;
    itemType: string;
    packagingType: string;
    quantity: number;
    fromInventory: string;
    toInventory: string;
    performedBy: string;
    reason?: string;
    notes?: string;
  }): Promise<{ movement: StockMovement; updatedInventory: TechnicianFixedInventory }>;

  getWarehouses(): Promise<WarehouseWithStats[]>;
  getWarehousesByRegion(regionId: string): Promise<WarehouseWithStats[]>;
  getWarehouse(id: string): Promise<WarehouseWithInventory | undefined>;
  createWarehouse(warehouse: InsertWarehouse, createdBy: string): Promise<Warehouse>;
  updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse>;
  deleteWarehouse(id: string): Promise<boolean>;

  getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | undefined>;
  updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory>;

  transferFromWarehouse(data: InsertWarehouseTransfer): Promise<WarehouseTransfer>;
  getWarehouseTransfers(warehouseId?: string, technicianId?: string, regionId?: string, limit?: number): Promise<WarehouseTransferWithDetails[]>;
  acceptWarehouseTransfer(transferId: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(transferId: string, reason?: string): Promise<WarehouseTransfer>;

  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorTechnicians(supervisorId: string): Promise<string[]>;
  getTechnicianSupervisor(technicianId: string): Promise<string | null>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<string[]>;

  getSystemLogs(filters: {
    limit?: number;
    offset?: number;
    userId?: string;
    regionId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    severity?: string;
  }): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;

  getItemTypes(): Promise<ItemType[]>;
  getActiveItemTypes(): Promise<ItemType[]>;
  getItemTypeById(id: string): Promise<ItemType | undefined>;
  createItemType(data: InsertItemType): Promise<ItemType>;
  updateItemType(id: string, data: Partial<InsertItemType>): Promise<ItemType | undefined>;
  deleteItemType(id: string): Promise<boolean>;
  toggleItemTypeActive(id: string, isActive: boolean): Promise<ItemType | undefined>;
  toggleItemTypeVisibility(id: string, isVisible: boolean): Promise<ItemType | undefined>;
  seedDefaultItemTypes(): Promise<void>;

  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<WarehouseInventoryEntry>;
  getTechnicianFixedInventoryEntries(technicianId: string): Promise<TechnicianFixedInventoryEntry[]>;
  upsertTechnicianFixedInventoryEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<TechnicianFixedInventoryEntry>;
  getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]>;
  upsertTechnicianMovingInventoryEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<TechnicianMovingInventoryEntry>;
  migrateToInventoryEntries(): Promise<void>;
}

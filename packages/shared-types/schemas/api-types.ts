import type {
  InventoryItem,
  StockMovement,
  TechnicianFixedInventory,
  TechnicianInventory,
  Transaction,
} from "./inventory.schema";
import type {
  Region,
} from "./catalog.schema";
import type {
  UserSafe,
  Warehouse,
  WarehouseInventory,
  WarehouseTransfer,
} from "./organization.schema";

export type InventoryItemWithStatus = InventoryItem & {
  status: "available" | "low" | "out";
  regionName?: string;
};

export type RegionWithStats = Region & {
  itemCount: number;
  totalQuantity: number;
  lowStockCount: number;
};

export type TransactionWithDetails = Transaction & {
  itemName?: string;
  userName?: string;
  regionName?: string;
};

export type DashboardStats = {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  todayTransactions: number;
  totalRegions?: number;
  totalUsers?: number;
};

export type AdminStats = {
  totalRegions: number;
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  recentTransactions: TransactionWithDetails[];
};

export type TechnicianWithFixedInventory = {
  technicianId: string;
  technicianName: string;
  city: string;
  fixedInventory: TechnicianFixedInventory | null;
  alertLevel: "good" | "warning" | "critical";
};

export type TechnicianWithBothInventories = {
  technicianId: string;
  technicianName: string;
  city: string;
  regionId?: string | null;
  fixedInventory: (TechnicianFixedInventory & { entries?: any[] }) | { entries: any[] } | null;
  movingInventory: (TechnicianInventory & { entries?: any[] }) | { entries: any[] } | null;
  alertLevel: "good" | "warning" | "critical";
};

export type FixedInventoryItemStatus = {
  itemType: string;
  itemNameAr: string;
  boxes: number;
  units: number;
  total: number;
  alertLevel: "good" | "warning" | "critical";
};

export type FixedInventorySummary = {
  totalN950: number;
  totalI9000s: number;
  totalI9100: number;
  totalRollPaper: number;
  totalStickers: number;
  totalNewBatteries: number;
  totalMobilySim: number;
  totalStcSim: number;
  totalZainSim: number;
  techniciansWithCriticalStock: number;
  techniciansWithWarningStock: number;
  techniciansWithGoodStock: number;
};

export type StockMovementWithDetails = StockMovement & {
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
};

export type WarehouseWithInventory = Warehouse & {
  inventory: WarehouseInventory | null;
  creatorName?: string;
  technicians?: UserSafe[];
};

export type WarehouseWithStats = Warehouse & {
  inventory: WarehouseInventory | null;
  totalItems: number;
  lowStockItemsCount: number;
  creatorName?: string;
};

export type WarehouseTransferWithDetails = WarehouseTransfer & {
  warehouseName?: string;
  technicianName?: string;
  performedByName?: string;
  itemNameAr?: string;
};

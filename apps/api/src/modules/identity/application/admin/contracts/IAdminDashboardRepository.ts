import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';

export interface IAdminDashboardRepository {
  getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]>;
  getFixedInventorySummary(): Promise<FixedInventorySummary>;
  getAllTechniciansWithBothInventories(): Promise<TechnicianWithBothInventories[]>;
  getInventoryRequests(): Promise<InventoryRequest[]>;
  getPendingInventoryRequestsCount(): Promise<number>;
}

import type { InventoryRequest, InsertInventoryRequest } from "@shared/schema";

export interface IInventoryRequestsRepository {
  getInventoryRequests(warehouseId?: string, technicianId?: string, status?: string): Promise<(InventoryRequest & { technicianName: string })[]>;
  createInventoryRequest(request: InsertInventoryRequest): Promise<InventoryRequest>;
  updateInventoryRequest(id: string, updates: Partial<InsertInventoryRequest>): Promise<InventoryRequest>;
  deleteInventoryRequest(id: string): Promise<boolean>;
  getSupervisorRequestsByRegion(regionId: string, status?: string): Promise<any[]>;
}

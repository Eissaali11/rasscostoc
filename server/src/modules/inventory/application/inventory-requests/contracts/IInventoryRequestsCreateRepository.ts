import type { InventoryRequest, InsertInventoryRequest } from "@shared/schema";

export interface IInventoryRequestsCreateRepository {
  getByTechnicianId(technicianId: string): Promise<InventoryRequest[]>;
  create(data: InsertInventoryRequest): Promise<InventoryRequest>;
}

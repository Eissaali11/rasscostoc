import { repositories } from "./index";
import type { InsertWarehouseTransfer } from "@shared/schema";

export async function getWarehouseTransfers(warehouseId?: string, technicianId?: string, regionId?: string, limit?: number) {
  return repositories.transfer.getWarehouseTransfers(warehouseId, technicianId, regionId, limit);
}

export async function createWarehouseTransfer(data: InsertWarehouseTransfer) {
  return repositories.transfer.transferFromWarehouse(data);
}

export async function acceptWarehouseTransfer(id: string) {
  return repositories.transfer.acceptWarehouseTransfer(id);
}

export async function rejectWarehouseTransfer(id: string, reason?: string) {
  return repositories.transfer.rejectWarehouseTransfer(id, reason || "Rejected");
}

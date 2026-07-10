import { repositories } from "./index";
import type { InsertWarehouse, WarehouseWithInventory } from "@shared/schema";

export async function getWarehouses() {
  return repositories.warehouse.getWarehouses();
}

export async function getWarehousesByRegion(regionId: string) {
  const warehouses = await repositories.warehouse.getWarehouses();
  return warehouses.filter((warehouse) => warehouse.regionId === regionId);
}

export async function getWarehouse(id: string): Promise<WarehouseWithInventory | undefined> {
  return repositories.warehouse.getWarehouse(id);
}

export async function createWarehouse(warehouse: InsertWarehouse, createdBy: string) {
  return repositories.warehouse.createWarehouse(warehouse, createdBy);
}

export async function updateWarehouse(id: string, updates: Partial<InsertWarehouse>) {
  return repositories.warehouse.updateWarehouse(id, updates);
}

export async function deleteWarehouse(id: string) {
  return repositories.warehouse.deleteWarehouse(id);
}

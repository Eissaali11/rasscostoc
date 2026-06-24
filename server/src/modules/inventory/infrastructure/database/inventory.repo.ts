import { InventoryService } from "@modules/inventory/application/inventory.service";
import type { InsertInventoryItem, InventoryItemWithStatus } from "@shared/schema";

const inventoryService = new InventoryService();

export async function getInventoryItems(): Promise<InventoryItemWithStatus[]> {
  return inventoryService.getInventoryItems();
}

export async function getInventoryItem(id: string) {
  return inventoryService.getInventoryItem(id);
}

export async function createInventoryItem(item: InsertInventoryItem) {
  return inventoryService.createInventoryItem(item);
}

export async function updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>) {
  return inventoryService.updateInventoryItem(id, updates);
}

export async function deleteInventoryItem(id: string) {
  return inventoryService.deleteInventoryItem(id);
}

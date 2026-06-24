import type { InventoryItem } from '@shared/schema';

export type InventoryItemStockSnapshot = {
  id: string;
  quantity: number;
};

export interface IInventoryRepository {
  findById(itemId: string): Promise<InventoryItemStockSnapshot | undefined>;
  updateQuantity(itemId: string, nextQuantity: number): Promise<InventoryItem>;
}

import type { InventoryItem } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { inventoryItems } from "@shared/schema";

export class DrizzleInventoryRepository {
  constructor(private readonly executor: any) {}

  async findById(itemId: string): Promise<{ id: string; quantity: number } | undefined> {
    const [item] = await this.executor
      .select({
        id: inventoryItems.id,
        quantity: inventoryItems.quantity,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, itemId));

    return item || undefined;
  }

  async updateQuantity(itemId: string, nextQuantity: number): Promise<InventoryItem> {
    const [updatedItem] = await this.executor
      .update(inventoryItems)
      .set({
        quantity: nextQuantity,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    if (!updatedItem) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    return updatedItem;
  }
}

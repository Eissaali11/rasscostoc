import type { InventoryItem } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import { InventoryItemAggregate } from "@modules/inventory/domain/inventory-item.aggregate";

export type AddInventoryStockInput = {
  itemId: string;
  quantity: number;
  reason?: string;
  userId?: string;
};

export class AddInventoryStockUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: AddInventoryStockInput): Promise<InventoryItem> {
    return this.unitOfWork.execute(async ({ inventoryRepository, transactionLogRepository }) => {
      const item = await inventoryRepository.findById(input.itemId);
      if (!item) {
        throw new Error(`Item with id ${input.itemId} not found`);
      }

      const aggregate = InventoryItemAggregate.fromCurrentQuantity(item.quantity);
      const nextQuantity = aggregate.add(input.quantity);

      const updatedItem = await inventoryRepository.updateQuantity(input.itemId, nextQuantity);

      if (input.userId) {
        await transactionLogRepository.create({
          itemId: input.itemId,
          type: 'add',
          quantity: input.quantity,
          reason: input.reason || 'Stock addition',
          userId: input.userId,
        });
      }

      return updatedItem;
    });
  }
}

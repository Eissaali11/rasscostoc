import type { InventoryItem } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import { InventoryItemAggregate } from "@modules/inventory/domain/inventory-item.aggregate";

export type WithdrawInventoryStockInput = {
  itemId: string;
  quantity: number;
  reason?: string;
  userId?: string;
};

export class WithdrawInventoryStockUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: WithdrawInventoryStockInput): Promise<InventoryItem> {
    return this.unitOfWork.execute(async ({ inventoryRepository, transactionLogRepository }) => {
      const item = await inventoryRepository.findById(input.itemId);
      if (!item) {
        throw new Error(`Item with id ${input.itemId} not found`);
      }

      const aggregate = InventoryItemAggregate.fromCurrentQuantity(item.quantity);
      const nextQuantity = aggregate.withdraw(input.quantity);

      const updatedItem = await inventoryRepository.updateQuantity(input.itemId, nextQuantity);

      if (input.userId) {
        await transactionLogRepository.create({
          itemId: input.itemId,
          type: 'withdraw',
          quantity: input.quantity,
          reason: input.reason || 'Stock withdrawal',
          userId: input.userId,
        });
      }

      return updatedItem;
    });
  }
}

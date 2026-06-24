import { transactions } from "@shared/schema";
import type { CreateInventoryTransactionInput } from "@modules/inventory/application/inventory/contracts/IInventoryTransactionLogRepository";

export class DrizzleInventoryTransactionLogRepository {
  constructor(private readonly executor: any) {}

  async create(input: CreateInventoryTransactionInput): Promise<void> {
    await this.executor.insert(transactions).values({
      itemId: input.itemId,
      userId: input.userId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
    });
  }
}

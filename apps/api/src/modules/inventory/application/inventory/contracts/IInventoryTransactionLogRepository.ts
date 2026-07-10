export type InventoryTransactionType = 'add' | 'withdraw';

export type CreateInventoryTransactionInput = {
  itemId: string;
  type: InventoryTransactionType;
  quantity: number;
  reason?: string;
  userId?: string;
};

export interface IInventoryTransactionLogRepository {
  create(input: CreateInventoryTransactionInput): Promise<void>;
}

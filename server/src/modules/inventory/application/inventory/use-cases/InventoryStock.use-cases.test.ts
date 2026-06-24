import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '@shared/schema';
import type { IInventoryRepository } from '../contracts/IInventoryRepository';
import type {
  CreateInventoryTransactionInput,
  IInventoryTransactionLogRepository,
} from '../contracts/IInventoryTransactionLogRepository';
import type {
  IInventoryUnitOfWork,
  InventoryTransactionalContext,
} from '../contracts/IInventoryUnitOfWork';
import { AddInventoryStockUseCase } from './AddInventoryStock.use-case';
import { WithdrawInventoryStockUseCase } from './WithdrawInventoryStock.use-case';
import {
  InsufficientStockError,
  InvalidStockQuantityError,
} from "@modules/inventory/domain/inventory-item.aggregate";

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    name: 'Router',
    type: 'devices',
    unit: 'piece',
    quantity: 10,
    minThreshold: 2,
    technicianName: null,
    city: null,
    regionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class InMemoryInventoryRepository implements IInventoryRepository {
  constructor(private item: InventoryItem | undefined) {}

  async findById(itemId: string): Promise<{ id: string; quantity: number } | undefined> {
    if (!this.item || this.item.id !== itemId) return undefined;
    return { id: this.item.id, quantity: this.item.quantity };
  }

  async updateQuantity(itemId: string, nextQuantity: number): Promise<InventoryItem> {
    if (!this.item || this.item.id !== itemId) {
      throw new Error(`Item with id ${itemId} not found`);
    }

    this.item = {
      ...this.item,
      quantity: nextQuantity,
      updatedAt: new Date(),
    };

    return this.item;
  }

  current(): InventoryItem | undefined {
    return this.item;
  }
}

class InMemoryTransactionLogRepository implements IInventoryTransactionLogRepository {
  readonly logs: CreateInventoryTransactionInput[] = [];

  async create(input: CreateInventoryTransactionInput): Promise<void> {
    this.logs.push(input);
  }
}

class FakeInventoryUnitOfWork implements IInventoryUnitOfWork {
  constructor(private readonly context: InventoryTransactionalContext) {}

  async execute<T>(work: (context: InventoryTransactionalContext) => Promise<T>): Promise<T> {
    return work(this.context);
  }
}

describe('Inventory stock use cases', () => {
  it('adds stock and records transaction when userId exists', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(makeInventoryItem({ quantity: 10 }));
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const useCase = new AddInventoryStockUseCase(unitOfWork);

    const result = await useCase.execute({
      itemId: 'item-1',
      quantity: 5,
      reason: 'Manual add',
      userId: 'user-1',
    });

    expect(result.quantity).toBe(15);
    expect(transactionLogRepository.logs).toHaveLength(1);
    expect(transactionLogRepository.logs[0]).toMatchObject({
      type: 'add',
      quantity: 5,
      userId: 'user-1',
    });
  });

  it('adds stock without creating log when userId is missing', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(makeInventoryItem({ quantity: 2 }));
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const useCase = new AddInventoryStockUseCase(unitOfWork);

    const result = await useCase.execute({ itemId: 'item-1', quantity: 3 });

    expect(result.quantity).toBe(5);
    expect(transactionLogRepository.logs).toHaveLength(0);
  });

  it('throws when adding stock to missing item', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(undefined);
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const useCase = new AddInventoryStockUseCase(unitOfWork);

    await expect(useCase.execute({ itemId: 'missing', quantity: 1 })).rejects.toThrowError(
      'Item with id missing not found'
    );
  });

  it('withdraws stock and records transaction atomically', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(makeInventoryItem({ quantity: 10 }));
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const useCase = new WithdrawInventoryStockUseCase(unitOfWork);

    const result = await useCase.execute({
      itemId: 'item-1',
      quantity: 4,
      reason: 'Customer issue',
      userId: 'user-2',
    });

    expect(result.quantity).toBe(6);
    expect(transactionLogRepository.logs).toHaveLength(1);
    expect(transactionLogRepository.logs[0]).toMatchObject({ type: 'withdraw', quantity: 4 });
  });

  it('throws on insufficient stock', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(makeInventoryItem({ quantity: 2 }));
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const useCase = new WithdrawInventoryStockUseCase(unitOfWork);

    await expect(useCase.execute({ itemId: 'item-1', quantity: 5 })).rejects.toThrowError(
      InsufficientStockError
    );
    expect(transactionLogRepository.logs).toHaveLength(0);
    expect(inventoryRepository.current()?.quantity).toBe(2);
  });

  it('throws on invalid quantity', async () => {
    const inventoryRepository = new InMemoryInventoryRepository(makeInventoryItem({ quantity: 2 }));
    const transactionLogRepository = new InMemoryTransactionLogRepository();
    const unitOfWork = new FakeInventoryUnitOfWork({ inventoryRepository, transactionLogRepository });
    const addUseCase = new AddInventoryStockUseCase(unitOfWork);
    const withdrawUseCase = new WithdrawInventoryStockUseCase(unitOfWork);

    await expect(addUseCase.execute({ itemId: 'item-1', quantity: 0 })).rejects.toThrowError(
      InvalidStockQuantityError
    );
    await expect(withdrawUseCase.execute({ itemId: 'item-1', quantity: -1 })).rejects.toThrowError(
      InvalidStockQuantityError
    );
  });
});

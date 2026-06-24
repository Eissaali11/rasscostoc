import { describe, expect, it } from 'vitest';
import type { InventoryItem, StockMovement, WarehouseTransfer } from '@shared/schema';
import type { IInventoryRepository } from '../contracts/IInventoryRepository';
import type {
  CreateInventoryTransactionInput,
  IInventoryTransactionLogRepository,
} from '../contracts/IInventoryTransactionLogRepository';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type {
  CreateStockMovementInput,
  IStockMovementRepository,
} from '../contracts/IStockMovementRepository';
import type {
  IWarehouseTransferBatchRepository,
  TechnicianMovingStockBalance,
  WarehouseStockBalance,
  WarehouseTransferRecord,
} from '../contracts/IWarehouseTransferBatchRepository';
import {
  AcceptWarehouseTransferBatchUseCase,
} from './AcceptWarehouseTransferBatch.use-case';
import { WarehouseBatchStockError } from './warehouse-transfer-batch.processor';

class NoopInventoryRepository implements IInventoryRepository {
  async findById(): Promise<{ id: string; quantity: number } | undefined> {
    return undefined;
  }

  async updateQuantity(): Promise<InventoryItem> {
    throw new Error('Not implemented');
  }
}

class NoopTransactionLogRepository implements IInventoryTransactionLogRepository {
  async create(_input: CreateInventoryTransactionInput): Promise<void> {
    return;
  }
}

function transferFixture(overrides: Partial<WarehouseTransferRecord> = {}): WarehouseTransferRecord {
  return {
    id: 't1',
    warehouseId: 'w1',
    technicianId: 'tech1',
    itemType: 'n950',
    packagingType: 'box',
    quantity: 1,
    status: 'pending',
    performedBy: 'admin1',
    notes: null,
    ...overrides,
  };
}

class InMemoryWarehouseBatchRepository implements IWarehouseTransferBatchRepository {
  constructor(
    private transfers: WarehouseTransferRecord[],
    private warehouseBalances: Map<string, WarehouseStockBalance>,
    private technicianBalances: Map<string, TechnicianMovingStockBalance>
  ) {}

  private warehouseKey(warehouseId: string, itemTypeId: string): string {
    return `${warehouseId}:${itemTypeId}`;
  }

  private technicianKey(technicianId: string, itemTypeId: string): string {
    return `${technicianId}:${itemTypeId}`;
  }

  async getTransfersByIds(transferIds: string[]): Promise<WarehouseTransferRecord[]> {
    return this.transfers.filter((transfer) => transferIds.includes(transfer.id));
  }

  async findPendingTransferIdsByCriteria(criteria?: {
    warehouseId?: string;
    technicianId?: string;
    regionId?: string;
    limit?: number;
  }): Promise<string[]> {
    let rows = this.transfers.filter((transfer) => transfer.status === 'pending');

    if (criteria?.warehouseId) {
      rows = rows.filter((transfer) => transfer.warehouseId === criteria.warehouseId);
    }

    if (criteria?.technicianId) {
      rows = rows.filter((transfer) => transfer.technicianId === criteria.technicianId);
    }

    if (criteria?.limit && criteria.limit > 0) {
      rows = rows.slice(0, criteria.limit);
    }

    return rows.map((transfer) => transfer.id);
  }

  async getWarehouseBalance(warehouseId: string, itemTypeId: string): Promise<WarehouseStockBalance> {
    return this.warehouseBalances.get(this.warehouseKey(warehouseId, itemTypeId)) || {
      boxes: 0,
      units: 0,
      source: 'entries',
    };
  }

  async setWarehouseBalance(warehouseId: string, itemTypeId: string, balance: WarehouseStockBalance): Promise<void> {
    this.warehouseBalances.set(this.warehouseKey(warehouseId, itemTypeId), { ...balance });
  }

  async getTechnicianMovingBalance(
    technicianId: string,
    itemTypeId: string
  ): Promise<TechnicianMovingStockBalance> {
    return this.technicianBalances.get(this.technicianKey(technicianId, itemTypeId)) || {
      boxes: 0,
      units: 0,
    };
  }

  async setTechnicianMovingBalance(
    technicianId: string,
    itemTypeId: string,
    balance: TechnicianMovingStockBalance
  ): Promise<void> {
    this.technicianBalances.set(this.technicianKey(technicianId, itemTypeId), { ...balance });
  }

  async markTransfersApproved(transferIds: string[]): Promise<WarehouseTransfer[]> {
    this.transfers = this.transfers.map((transfer) =>
      transferIds.includes(transfer.id)
        ? {
            ...transfer,
            status: 'accepted',
          }
        : transfer
    );

    return this.transfers
      .filter((transfer) => transferIds.includes(transfer.id))
      .map(
        (transfer): WarehouseTransfer => ({
          id: transfer.id,
          requestId: null,
          warehouseId: transfer.warehouseId,
          technicianId: transfer.technicianId,
          itemType: transfer.itemType,
          packagingType: transfer.packagingType,
          quantity: transfer.quantity,
          performedBy: transfer.performedBy,
          notes: transfer.notes ?? null,
          status: transfer.status,
          rejectionReason: null,
          respondedAt: new Date(),
          createdAt: new Date(),
        })
      );
  }

  clone(): InMemoryWarehouseBatchRepository {
    return new InMemoryWarehouseBatchRepository(
      this.transfers.map((transfer) => ({ ...transfer })),
      new Map([...this.warehouseBalances.entries()].map(([key, value]) => [key, { ...value }])),
      new Map([...this.technicianBalances.entries()].map(([key, value]) => [key, { ...value }]))
    );
  }

  applyFrom(source: InMemoryWarehouseBatchRepository): void {
    this.transfers = source.transfers.map((transfer) => ({ ...transfer }));
    this.warehouseBalances = new Map(
      [...source.warehouseBalances.entries()].map(([key, value]) => [key, { ...value }])
    );
    this.technicianBalances = new Map(
      [...source.technicianBalances.entries()].map(([key, value]) => [key, { ...value }])
    );
  }

  snapshot() {
    return {
      transfers: this.transfers.map((transfer) => ({ ...transfer })),
      warehouseBalances: new Map(this.warehouseBalances),
      technicianBalances: new Map(this.technicianBalances),
    };
  }
}

class InMemoryStockMovementRepository implements IStockMovementRepository {
  readonly movements: StockMovement[] = [];

  async create(input: CreateStockMovementInput): Promise<StockMovement> {
    const [movement] = await this.createMany([input]);
    return movement;
  }

  async createMany(inputs: CreateStockMovementInput[]): Promise<StockMovement[]> {
    const created = inputs.map((input, index) => ({
      id: `m-${this.movements.length + index + 1}`,
      technicianId: input.technicianId,
      itemType: input.itemType,
      packagingType: input.packagingType,
      quantity: input.quantity,
      fromInventory: input.fromInventory,
      toInventory: input.toInventory,
      reason: input.reason ?? null,
      performedBy: input.performedBy,
      notes: input.notes ?? null,
      createdAt: new Date(),
    })) as StockMovement[];

    this.movements.push(...created);
    return created;
  }

  clone(): InMemoryStockMovementRepository {
    const cloned = new InMemoryStockMovementRepository();
    cloned.movements.push(...this.movements.map((movement) => ({ ...movement })));
    return cloned;
  }

  applyFrom(source: InMemoryStockMovementRepository): void {
    this.movements.length = 0;
    this.movements.push(...source.movements.map((movement) => ({ ...movement })));
  }
}

class TransactionalFakeInventoryUnitOfWork implements IInventoryUnitOfWork {
  constructor(
    private readonly batchRepository: InMemoryWarehouseBatchRepository,
    private readonly movementRepository: InMemoryStockMovementRepository
  ) {}

  async execute<T>(work: (context: any) => Promise<T>): Promise<T> {
    const batchRepoClone = this.batchRepository.clone();
    const movementRepoClone = this.movementRepository.clone();

    try {
      const result = await work({
        inventoryRepository: new NoopInventoryRepository(),
        transactionLogRepository: new NoopTransactionLogRepository(),
        stockMovementRepository: movementRepoClone,
        warehouseTransferBatchRepository: batchRepoClone,
      });

      this.batchRepository.applyFrom(batchRepoClone);
      this.movementRepository.applyFrom(movementRepoClone);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

describe('AcceptWarehouseTransferBatchUseCase', () => {
  it('accepts the full batch successfully', async () => {
    const transfers = [
      transferFixture({ id: 't1', quantity: 2 }),
      transferFixture({ id: 't2', itemType: 'i9000s', quantity: 1 }),
    ];

    const warehouseBalances = new Map<string, WarehouseStockBalance>([
      ['w1:n950', { boxes: 10, units: 0, source: 'entries' }],
      ['w1:i9000s', { boxes: 5, units: 0, source: 'entries' }],
    ]);

    const technicianBalances = new Map<string, TechnicianMovingStockBalance>([
      ['tech1:n950', { boxes: 1, units: 0 }],
      ['tech1:i9000s', { boxes: 0, units: 0 }],
    ]);

    const batchRepo = new InMemoryWarehouseBatchRepository(transfers, warehouseBalances, technicianBalances);
    const movementRepo = new InMemoryStockMovementRepository();
    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(batchRepo, movementRepo);
    const useCase = new AcceptWarehouseTransferBatchUseCase(unitOfWork);

    const result = await useCase.execute(['t1', 't2']);

    expect(result).toHaveLength(2);
    expect(result.every((transfer) => transfer.status === 'accepted')).toBe(true);
    expect(movementRepo.movements).toHaveLength(2);
  });

  it('rolls back entire batch on partial failure', async () => {
    const transfers = [
      transferFixture({ id: 't1', quantity: 2 }),
      transferFixture({ id: 't2', itemType: 'i9000s', quantity: 3 }),
      transferFixture({ id: 't3', itemType: 'rollPaper', quantity: 1 }),
    ];

    const warehouseBalances = new Map<string, WarehouseStockBalance>([
      ['w1:n950', { boxes: 10, units: 0, source: 'entries' }],
      ['w1:i9000s', { boxes: 2, units: 0, source: 'entries' }],
      ['w1:rollPaper', { boxes: 9, units: 0, source: 'entries' }],
    ]);

    const technicianBalances = new Map<string, TechnicianMovingStockBalance>([
      ['tech1:n950', { boxes: 1, units: 0 }],
      ['tech1:i9000s', { boxes: 0, units: 0 }],
      ['tech1:rollPaper', { boxes: 0, units: 0 }],
    ]);

    const batchRepo = new InMemoryWarehouseBatchRepository(transfers, warehouseBalances, technicianBalances);
    const initialSnapshot = batchRepo.snapshot();
    const movementRepo = new InMemoryStockMovementRepository();
    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(batchRepo, movementRepo);
    const useCase = new AcceptWarehouseTransferBatchUseCase(unitOfWork);

    await expect(useCase.execute(['t1', 't2', 't3'])).rejects.toThrowError(WarehouseBatchStockError);

    const afterSnapshot = batchRepo.snapshot();
    expect(afterSnapshot.transfers).toEqual(initialSnapshot.transfers);
    expect(Array.from(afterSnapshot.warehouseBalances.entries())).toEqual(
      Array.from(initialSnapshot.warehouseBalances.entries())
    );
    expect(Array.from(afterSnapshot.technicianBalances.entries())).toEqual(
      Array.from(initialSnapshot.technicianBalances.entries())
    );
    expect(movementRepo.movements).toHaveLength(0);
  });
});

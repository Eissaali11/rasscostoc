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
  WarehouseTransferBatchCriteria,
  WarehouseTransferRecord,
} from '../contracts/IWarehouseTransferBatchRepository';
import { AcceptBulkWarehouseTransfersUseCase } from './AcceptBulkWarehouseTransfers.use-case';

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
  readonly resolvedCriteriaCalls: WarehouseTransferBatchCriteria[] = [];
  readonly transferIdCalls: string[][] = [];

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

  async findPendingTransferIdsByCriteria(criteria?: WarehouseTransferBatchCriteria): Promise<string[]> {
    this.resolvedCriteriaCalls.push(criteria || {});

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

  async getTransfersByIds(transferIds: string[]): Promise<WarehouseTransferRecord[]> {
    this.transferIdCalls.push([...transferIds]);
    return this.transfers.filter((transfer) => transferIds.includes(transfer.id));
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
      transferIds.includes(transfer.id) ? { ...transfer, status: 'accepted' } : transfer
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
    const cloned = new InMemoryWarehouseBatchRepository(
      this.transfers.map((transfer) => ({ ...transfer })),
      new Map([...this.warehouseBalances.entries()].map(([key, value]) => [key, { ...value }])),
      new Map([...this.technicianBalances.entries()].map(([key, value]) => [key, { ...value }]))
    );
    cloned.resolvedCriteriaCalls.push(...this.resolvedCriteriaCalls.map((value) => ({ ...value })));
    cloned.transferIdCalls.push(...this.transferIdCalls.map((value) => [...value]));
    return cloned;
  }

  applyFrom(source: InMemoryWarehouseBatchRepository): void {
    this.transfers = source.transfers.map((transfer) => ({ ...transfer }));
    this.warehouseBalances = new Map(
      [...source.warehouseBalances.entries()].map(([key, value]) => [key, { ...value }])
    );
    this.technicianBalances = new Map(
      [...source.technicianBalances.entries()].map(([key, value]) => [key, { ...value }])
    );
    this.resolvedCriteriaCalls.length = 0;
    this.resolvedCriteriaCalls.push(...source.resolvedCriteriaCalls.map((value) => ({ ...value })));
    this.transferIdCalls.length = 0;
    this.transferIdCalls.push(...source.transferIdCalls.map((value) => [...value]));
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

describe('AcceptBulkWarehouseTransfersUseCase', () => {
  it('resolves criteria to pending transfer ids and processes via shared batch engine', async () => {
    const repository = new InMemoryWarehouseBatchRepository(
      [
        transferFixture({ id: 't1', warehouseId: 'w1', quantity: 2, status: 'pending' }),
        transferFixture({ id: 't2', warehouseId: 'w2', quantity: 1, status: 'pending' }),
        transferFixture({ id: 't3', warehouseId: 'w1', quantity: 3, status: 'accepted' }),
      ],
      new Map([
        ['w1:n950', { boxes: 10, units: 0, source: 'entries' }],
        ['w2:n950', { boxes: 10, units: 0, source: 'entries' }],
      ]),
      new Map([
        ['tech1:n950', { boxes: 1, units: 0 }],
      ])
    );
    const movementRepository = new InMemoryStockMovementRepository();
    const useCase = new AcceptBulkWarehouseTransfersUseCase(
      new TransactionalFakeInventoryUnitOfWork(repository, movementRepository)
    );

    const result = await useCase.execute({ warehouseId: 'w1' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
    expect(repository.transferIdCalls.at(-1)).toEqual(['t1']);
    expect(movementRepository.movements).toHaveLength(1);
  });

  it('returns empty array when criteria resolves no pending transfers', async () => {
    const repository = new InMemoryWarehouseBatchRepository(
      [transferFixture({ id: 't1', status: 'accepted' })],
      new Map([['w1:n950', { boxes: 10, units: 0, source: 'entries' }]]),
      new Map([['tech1:n950', { boxes: 1, units: 0 }]])
    );
    const movementRepository = new InMemoryStockMovementRepository();
    const useCase = new AcceptBulkWarehouseTransfersUseCase(
      new TransactionalFakeInventoryUnitOfWork(repository, movementRepository)
    );

    const result = await useCase.execute({ warehouseId: 'w1' });

    expect(result).toEqual([]);
    expect(repository.transferIdCalls).toHaveLength(0);
    expect(movementRepository.movements).toHaveLength(0);
  });
});

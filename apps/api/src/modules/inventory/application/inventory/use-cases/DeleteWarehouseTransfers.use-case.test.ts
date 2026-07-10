import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '@shared/schema';
import type { IInventoryRepository } from '../contracts/IInventoryRepository';
import type {
  CreateInventoryTransactionInput,
  IInventoryTransactionLogRepository,
} from '../contracts/IInventoryTransactionLogRepository';
import type { IInventoryUnitOfWork, InventoryTransactionalContext } from '../contracts/IInventoryUnitOfWork';
import type {
  IWarehouseTransferAdminRepository,
  LegacyStockSnapshot,
  WarehouseTransferAdminRecord,
} from '../contracts/IWarehouseTransferAdminRepository';
import { DeleteWarehouseTransfersUseCase } from './DeleteWarehouseTransfers.use-case';

function legacyStock(overrides: Partial<LegacyStockSnapshot> = {}): LegacyStockSnapshot {
  return {
    n950Boxes: 0,
    n950Units: 0,
    i9000sBoxes: 0,
    i9000sUnits: 0,
    i9100Boxes: 0,
    i9100Units: 0,
    rollPaperBoxes: 0,
    rollPaperUnits: 0,
    stickersBoxes: 0,
    stickersUnits: 0,
    newBatteriesBoxes: 0,
    newBatteriesUnits: 0,
    mobilySimBoxes: 0,
    mobilySimUnits: 0,
    stcSimBoxes: 0,
    stcSimUnits: 0,
    zainSimBoxes: 0,
    zainSimUnits: 0,
    ...overrides,
  };
}

class NoopInventoryRepository implements IInventoryRepository {
  async findById(): Promise<{ id: string; quantity: number } | undefined> {
    return undefined;
  }

  async updateQuantity(): Promise<InventoryItem> {
    throw new Error('Not implemented in this test');
  }
}

class NoopTransactionRepository implements IInventoryTransactionLogRepository {
  async create(_input: CreateInventoryTransactionInput): Promise<void> {
    return;
  }
}

class InMemoryWarehouseTransferAdminRepository implements IWarehouseTransferAdminRepository {
  constructor(
    private transfers = new Map<string, WarehouseTransferAdminRecord>(),
    private warehouses = new Map<string, LegacyStockSnapshot>(),
    private techniciansById = new Map<string, string>(),
    private movingByName = new Map<string, LegacyStockSnapshot>()
  ) {}

  static fromSeed(seed: {
    transfers?: WarehouseTransferAdminRecord[];
    warehouseStocks?: Array<{ warehouseId: string; stock: LegacyStockSnapshot }>;
    techniciansById?: Array<{ technicianId: string; fullName: string }>;
    movingStocksByName?: Array<{ technicianName: string; stock: LegacyStockSnapshot }>;
  }): InMemoryWarehouseTransferAdminRepository {
    const transferMap = new Map<string, WarehouseTransferAdminRecord>();
    for (const transfer of seed.transfers || []) {
      transferMap.set(transfer.id, { ...transfer });
    }

    const warehouseMap = new Map<string, LegacyStockSnapshot>();
    for (const row of seed.warehouseStocks || []) {
      warehouseMap.set(row.warehouseId, legacyStock(row.stock));
    }

    const techMap = new Map<string, string>();
    for (const row of seed.techniciansById || []) {
      techMap.set(row.technicianId, row.fullName);
    }

    const movingMap = new Map<string, LegacyStockSnapshot>();
    for (const row of seed.movingStocksByName || []) {
      movingMap.set(row.technicianName, legacyStock(row.stock));
    }

    return new InMemoryWarehouseTransferAdminRepository(transferMap, warehouseMap, techMap, movingMap);
  }

  async getTransfersByIds(ids: string[]): Promise<WarehouseTransferAdminRecord[]> {
    return ids
      .map((id) => this.transfers.get(id))
      .filter((item): item is WarehouseTransferAdminRecord => Boolean(item))
      .map((item) => ({ ...item }));
  }

  async getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<LegacyStockSnapshot | undefined> {
    const row = this.warehouses.get(warehouseId);
    return row ? legacyStock(row) : undefined;
  }

  async updateWarehouseInventoryByWarehouseId(warehouseId: string, updates: LegacyStockSnapshot): Promise<void> {
    this.warehouses.set(warehouseId, legacyStock(updates));
  }

  async getTechnicianFullNameById(technicianId: string): Promise<string | undefined> {
    return this.techniciansById.get(technicianId);
  }

  async getTechnicianMovingInventoryByName(technicianName: string): Promise<LegacyStockSnapshot | undefined> {
    const row = this.movingByName.get(technicianName);
    return row ? legacyStock(row) : undefined;
  }

  async updateTechnicianMovingInventoryByName(technicianName: string, updates: LegacyStockSnapshot): Promise<void> {
    this.movingByName.set(technicianName, legacyStock(updates));
  }

  async deleteTransfersByIds(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.transfers.delete(id);
    }
  }

  hasTransfer(id: string): boolean {
    return this.transfers.has(id);
  }

  getWarehouseStock(warehouseId: string): LegacyStockSnapshot | undefined {
    const row = this.warehouses.get(warehouseId);
    return row ? legacyStock(row) : undefined;
  }

  getMovingStockByName(technicianName: string): LegacyStockSnapshot | undefined {
    const row = this.movingByName.get(technicianName);
    return row ? legacyStock(row) : undefined;
  }

  clone(): InMemoryWarehouseTransferAdminRepository {
    const cloneTransfers = new Map<string, WarehouseTransferAdminRecord>();
    for (const [id, transfer] of this.transfers.entries()) {
      cloneTransfers.set(id, { ...transfer });
    }

    const cloneWarehouses = new Map<string, LegacyStockSnapshot>();
    for (const [id, stock] of this.warehouses.entries()) {
      cloneWarehouses.set(id, legacyStock(stock));
    }

    const cloneTechnicians = new Map<string, string>(this.techniciansById);

    const cloneMoving = new Map<string, LegacyStockSnapshot>();
    for (const [name, stock] of this.movingByName.entries()) {
      cloneMoving.set(name, legacyStock(stock));
    }

    return new InMemoryWarehouseTransferAdminRepository(
      cloneTransfers,
      cloneWarehouses,
      cloneTechnicians,
      cloneMoving
    );
  }

  applyFrom(source: InMemoryWarehouseTransferAdminRepository): void {
    this.transfers = source.transfers;
    this.warehouses = source.warehouses;
    this.techniciansById = source.techniciansById;
    this.movingByName = source.movingByName;
  }
}

class TransactionalFakeInventoryUnitOfWork implements IInventoryUnitOfWork {
  constructor(private readonly repository: InMemoryWarehouseTransferAdminRepository) {}

  async execute<T>(work: (context: InventoryTransactionalContext) => Promise<T>): Promise<T> {
    const repositoryClone = this.repository.clone();

    const context: InventoryTransactionalContext = {
      inventoryRepository: new NoopInventoryRepository(),
      transactionLogRepository: new NoopTransactionRepository(),
      warehouseTransferAdminRepository: repositoryClone,
    };

    try {
      const result = await work(context);
      this.repository.applyFrom(repositoryClone);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

describe('DeleteWarehouseTransfersUseCase', () => {
  it('deletes transfers and reverts warehouse + accepted technician stock', async () => {
    const repository = InMemoryWarehouseTransferAdminRepository.fromSeed({
      transfers: [
        {
          id: 't1',
          warehouseId: 'w1',
          technicianId: 'tech-1',
          itemType: 'n950',
          packagingType: 'box',
          quantity: 2,
          status: 'pending',
        },
        {
          id: 't2',
          warehouseId: 'w1',
          technicianId: 'tech-1',
          itemType: 'i9100',
          packagingType: 'unit',
          quantity: 3,
          status: 'accepted',
        },
      ],
      warehouseStocks: [{ warehouseId: 'w1', stock: legacyStock({ n950Boxes: 10, i9100Units: 5 }) }],
      techniciansById: [{ technicianId: 'tech-1', fullName: 'Tech One' }],
      movingStocksByName: [{ technicianName: 'Tech One', stock: legacyStock({ i9100Units: 8 }) }],
    });

    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(repository);
    const useCase = new DeleteWarehouseTransfersUseCase(unitOfWork);

    const result = await useCase.execute({ ids: ['t1', 't2'] });

    expect(result).toEqual({
      message: 'Transfers deleted successfully and inventory returned to warehouse',
      count: 2,
    });

    expect(repository.hasTransfer('t1')).toBe(false);
    expect(repository.hasTransfer('t2')).toBe(false);

    expect(repository.getWarehouseStock('w1')).toMatchObject({
      n950Boxes: 12,
      i9100Units: 8,
    });

    expect(repository.getMovingStockByName('Tech One')).toMatchObject({
      i9100Units: 5,
    });
  });

  it('throws when no transfers are found by ids', async () => {
    const repository = InMemoryWarehouseTransferAdminRepository.fromSeed({});
    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(repository);
    const useCase = new DeleteWarehouseTransfersUseCase(unitOfWork);

    await expect(useCase.execute({ ids: ['missing'] })).rejects.toThrow(
      'No transfers found with the provided IDs'
    );
  });

  it('rolls back all changes when warehouse inventory is missing', async () => {
    const repository = InMemoryWarehouseTransferAdminRepository.fromSeed({
      transfers: [
        {
          id: 't1',
          warehouseId: 'w-missing',
          technicianId: 'tech-1',
          itemType: 'n950',
          packagingType: 'box',
          quantity: 2,
          status: 'pending',
        },
      ],
      techniciansById: [{ technicianId: 'tech-1', fullName: 'Tech One' }],
      movingStocksByName: [{ technicianName: 'Tech One', stock: legacyStock({ n950Boxes: 3 }) }],
    });

    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(repository);
    const useCase = new DeleteWarehouseTransfersUseCase(unitOfWork);

    await expect(useCase.execute({ ids: ['t1'] })).rejects.toThrow(
      'Warehouse inventory not found for warehouse ID: w-missing'
    );

    expect(repository.hasTransfer('t1')).toBe(true);
    expect(repository.getMovingStockByName('Tech One')).toMatchObject({ n950Boxes: 3 });
  });

  it('rolls back warehouse updates when accepted technician moving inventory is missing', async () => {
    const repository = InMemoryWarehouseTransferAdminRepository.fromSeed({
      transfers: [
        {
          id: 't1',
          warehouseId: 'w1',
          technicianId: 'tech-1',
          itemType: 'n950',
          packagingType: 'box',
          quantity: 4,
          status: 'accepted',
        },
      ],
      warehouseStocks: [{ warehouseId: 'w1', stock: legacyStock({ n950Boxes: 10 }) }],
      techniciansById: [{ technicianId: 'tech-1', fullName: 'Tech One' }],
    });

    const unitOfWork = new TransactionalFakeInventoryUnitOfWork(repository);
    const useCase = new DeleteWarehouseTransfersUseCase(unitOfWork);

    await expect(useCase.execute({ ids: ['t1'] })).rejects.toThrow(
      'Moving inventory not found for technician: Tech One'
    );

    expect(repository.hasTransfer('t1')).toBe(true);
    expect(repository.getWarehouseStock('w1')).toMatchObject({ n950Boxes: 10 });
  });
});

import { describe, expect, it } from 'vitest';
import type { InventoryItem, StockMovementWithDetails, WarehouseInventory } from '@shared/schema';
import type { IInventoryRepository } from '../contracts/IInventoryRepository';
import type {
  CreateInventoryTransactionInput,
  IInventoryTransactionLogRepository,
} from '../contracts/IInventoryTransactionLogRepository';
import type { IInventoryUnitOfWork, InventoryTransactionalContext } from '../contracts/IInventoryUnitOfWork';
import type { IWarehouseStockMovementsRepository } from '../contracts/IWarehouseStockMovementsRepository';
import { GetStockMovementsUseCase } from './GetStockMovements.use-case';
import {
  GetWarehouseInventoryUseCase,
  GetWarehouseInventoryUseCaseError,
} from './GetWarehouseInventory.use-case';

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

class InMemoryWarehouseStockMovementsRepository implements IWarehouseStockMovementsRepository {
  readonly getAllCalls: number[] = [];
  readonly getRegionCalls: Array<string | null> = [];
  readonly getTechnicianCalls: string[] = [];
  readonly getSupervisorWarehouseIdsCalls: string[] = [];
  readonly getWarehouseInventoryCalls: string[] = [];

  constructor(
    private readonly allMovements: StockMovementWithDetails[],
    private readonly movementsByRegion: Map<string, StockMovementWithDetails[]>,
    private readonly movementsByTechnician: Map<string, StockMovementWithDetails[]>,
    private readonly supervisorWarehouseIds: Map<string, string[]>,
    private readonly inventoriesByWarehouse: Map<string, WarehouseInventory[]>
  ) {}

  async getStockMovements(limit: number = 50): Promise<StockMovementWithDetails[]> {
    this.getAllCalls.push(limit);
    return this.allMovements.slice(0, limit);
  }

  async getStockMovementsByRegion(regionId: string | null): Promise<StockMovementWithDetails[]> {
    this.getRegionCalls.push(regionId);
    if (!regionId) {
      return [];
    }

    return this.movementsByRegion.get(regionId) || [];
  }

  async getStockMovementsByTechnician(technicianId: string, limit: number = 50): Promise<StockMovementWithDetails[]> {
    this.getTechnicianCalls.push(technicianId);
    return (this.movementsByTechnician.get(technicianId) || []).slice(0, limit);
  }

  async getSupervisorWarehouseIds(supervisorId: string): Promise<string[]> {
    this.getSupervisorWarehouseIdsCalls.push(supervisorId);
    return this.supervisorWarehouseIds.get(supervisorId) || [];
  }

  async getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<WarehouseInventory[]> {
    this.getWarehouseInventoryCalls.push(warehouseId);
    return this.inventoriesByWarehouse.get(warehouseId) || [];
  }
}

class FakeInventoryUnitOfWork implements IInventoryUnitOfWork {
  constructor(private readonly repository: InMemoryWarehouseStockMovementsRepository) {}

  async execute<T>(work: (context: InventoryTransactionalContext) => Promise<T>): Promise<T> {
    return work({
      inventoryRepository: new NoopInventoryRepository(),
      transactionLogRepository: new NoopTransactionRepository(),
      warehouseStockMovementsRepository: this.repository,
    });
  }
}

function movementFixture(id: string): StockMovementWithDetails {
  return {
    id,
    technicianId: 'tech-1',
    itemType: 'n950',
    packagingType: 'box',
    quantity: 2,
    fromInventory: 'warehouse',
    toInventory: 'technician_moving',
    reason: null,
    performedBy: 'admin-1',
    notes: null,
    createdAt: new Date(),
    technicianName: 'Tech 1',
    performedByName: 'Admin 1',
    itemNameAr: 'n950',
  };
}

function inventoryFixture(warehouseId: string): WarehouseInventory {
  return {
    id: `inv-${warehouseId}`,
    warehouseId,
    n950Boxes: 1,
    n950Units: 2,
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
    updatedAt: new Date(),
  };
}

describe('Warehouse stock movements read use cases', () => {
  it('returns all stock movements for admin actor', async () => {
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [movementFixture('m1'), movementFixture('m2')],
      new Map(),
      new Map(),
      new Map(),
      new Map()
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetStockMovementsUseCase(unitOfWork);

    const result = await useCase.execute({
      actor: { id: 'admin-1', role: 'admin', regionId: null },
    });

    expect(result).toHaveLength(2);
    expect(repository.getAllCalls).toEqual([50]);
    expect(repository.getRegionCalls).toHaveLength(0);
    expect(repository.getTechnicianCalls).toHaveLength(0);
  });

  it('returns region stock movements for supervisor actor', async () => {
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [],
      new Map([['region-1', [movementFixture('m1')]]]),
      new Map(),
      new Map(),
      new Map()
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetStockMovementsUseCase(unitOfWork);

    const result = await useCase.execute({
      actor: { id: 'sup-1', role: 'supervisor', regionId: 'region-1' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
    expect(repository.getRegionCalls).toEqual(['region-1']);
    expect(repository.getAllCalls).toHaveLength(0);
    expect(repository.getTechnicianCalls).toHaveLength(0);
  });

  it('returns technician stock movements for technician actor', async () => {
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [],
      new Map(),
      new Map([['tech-1', [movementFixture('m-tech')]]]),
      new Map(),
      new Map()
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetStockMovementsUseCase(unitOfWork);

    const result = await useCase.execute({
      actor: { id: 'tech-1', role: 'technician', regionId: 'region-1' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m-tech');
    expect(repository.getTechnicianCalls).toEqual(['tech-1']);
    expect(repository.getAllCalls).toHaveLength(0);
    expect(repository.getRegionCalls).toHaveLength(0);
  });

  it('returns warehouse inventory for admin without supervisor warehouse lookup', async () => {
    const inventory = inventoryFixture('w-1');
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [],
      new Map(),
      new Map(),
      new Map(),
      new Map([['w-1', [inventory]]])
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetWarehouseInventoryUseCase(unitOfWork);

    const result = await useCase.execute({
      actor: { id: 'admin-1', role: 'admin' },
      warehouseId: 'w-1',
    });

    expect(result).toEqual([inventory]);
    expect(repository.getSupervisorWarehouseIdsCalls).toHaveLength(0);
    expect(repository.getWarehouseInventoryCalls).toEqual(['w-1']);
  });

  it('throws 403 when supervisor tries accessing non-assigned warehouse', async () => {
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [],
      new Map(),
      new Map(),
      new Map([['sup-1', ['w-2']]]),
      new Map([['w-1', [inventoryFixture('w-1')]]])
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetWarehouseInventoryUseCase(unitOfWork);

    await expect(
      useCase.execute({
        actor: { id: 'sup-1', role: 'supervisor' },
        warehouseId: 'w-1',
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Access denied to this warehouse',
    } satisfies Partial<GetWarehouseInventoryUseCaseError>);

    expect(repository.getSupervisorWarehouseIdsCalls).toEqual(['sup-1']);
    expect(repository.getWarehouseInventoryCalls).toHaveLength(0);
  });

  it('returns warehouse inventory for supervisor when warehouse is assigned', async () => {
    const inventory = inventoryFixture('w-1');
    const repository = new InMemoryWarehouseStockMovementsRepository(
      [],
      new Map(),
      new Map(),
      new Map([['sup-1', ['w-1', 'w-2']]]),
      new Map([['w-1', [inventory]]])
    );
    const unitOfWork = new FakeInventoryUnitOfWork(repository);
    const useCase = new GetWarehouseInventoryUseCase(unitOfWork);

    const result = await useCase.execute({
      actor: { id: 'sup-1', role: 'supervisor' },
      warehouseId: 'w-1',
    });

    expect(result).toEqual([inventory]);
    expect(repository.getSupervisorWarehouseIdsCalls).toEqual(['sup-1']);
    expect(repository.getWarehouseInventoryCalls).toEqual(['w-1']);
  });
});
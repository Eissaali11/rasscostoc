import { describe, expect, it, vi } from 'vitest';
import type { WarehouseWithStats } from "@shared/schema";
import type { ISupervisorWarehouseAssignmentsRepository } from "@modules/identity/application/users/contracts/ISupervisorWarehouseAssignmentsRepository";
import type { IWarehouseRepository } from '../contracts/IWarehouseRepository';
import { GetSupervisorWarehousesUseCase } from './GetSupervisorWarehouses.use-case';

type WarehouseRepoMock = {
  [K in keyof IWarehouseRepository]: ReturnType<typeof vi.fn>;
};

type SupervisorAssignmentsRepoMock = {
  [K in keyof ISupervisorWarehouseAssignmentsRepository]: ReturnType<typeof vi.fn>;
};

function createWarehouseRepoMock(): WarehouseRepoMock {
  return {
    getWarehouses: vi.fn(),
  };
}

function createSupervisorAssignmentsRepoMock(): SupervisorAssignmentsRepoMock {
  return {
    getSupervisorWarehouses: vi.fn(),
    assignWarehouseToSupervisor: vi.fn(),
    removeWarehouseFromSupervisor: vi.fn(),
  };
}

function warehouseFixture(overrides: Partial<WarehouseWithStats> = {}): WarehouseWithStats {
  return {
    id: 'wh-1',
    name: 'Warehouse 1',
    location: 'Riyadh',
    description: null,
    isActive: true,
    createdBy: 'admin-1',
    regionId: 'region-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    inventory: null,
    totalItems: 0,
    lowStockItemsCount: 0,
    creatorName: 'Admin',
    ...overrides,
  };
}

describe('GetSupervisorWarehousesUseCase', () => {
  it('returns only explicitly assigned warehouses when supervisor has no regionId', async () => {
    const warehouseRepo = createWarehouseRepoMock();
    const supervisorAssignmentsRepo = createSupervisorAssignmentsRepoMock();
    const useCase = new GetSupervisorWarehousesUseCase(warehouseRepo, supervisorAssignmentsRepo);

    warehouseRepo.getWarehouses.mockResolvedValue([
      warehouseFixture({ id: 'wh-1', regionId: 'region-1' }),
      warehouseFixture({ id: 'wh-2', regionId: 'region-2' }),
      warehouseFixture({ id: 'wh-3', regionId: 'region-1' }),
    ]);

    supervisorAssignmentsRepo.getSupervisorWarehouses.mockResolvedValue([
      { id: 'a-1', supervisorId: 'sup-1', warehouseId: 'wh-2', createdAt: new Date() },
      { id: 'a-2', supervisorId: 'sup-1', warehouseId: 'wh-3', createdAt: new Date() },
    ]);

    const result = await useCase.execute({ supervisorId: 'sup-1', regionId: null });

    expect(result.map((warehouse) => warehouse.id)).toEqual(['wh-2', 'wh-3']);
  });

  it('returns union of assigned and region warehouses without duplicates when supervisor has regionId', async () => {
    const warehouseRepo = createWarehouseRepoMock();
    const supervisorAssignmentsRepo = createSupervisorAssignmentsRepoMock();
    const useCase = new GetSupervisorWarehousesUseCase(warehouseRepo, supervisorAssignmentsRepo);

    warehouseRepo.getWarehouses.mockResolvedValue([
      warehouseFixture({ id: 'wh-1', regionId: 'region-1' }),
      warehouseFixture({ id: 'wh-2', regionId: 'region-1' }),
      warehouseFixture({ id: 'wh-3', regionId: 'region-2' }),
    ]);

    supervisorAssignmentsRepo.getSupervisorWarehouses.mockResolvedValue([
      { id: 'a-1', supervisorId: 'sup-1', warehouseId: 'wh-2', createdAt: new Date() },
      { id: 'a-2', supervisorId: 'sup-1', warehouseId: 'wh-3', createdAt: new Date() },
      { id: 'a-3', supervisorId: 'sup-1', warehouseId: 'wh-2', createdAt: new Date() },
    ]);

    const result = await useCase.execute({ supervisorId: 'sup-1', regionId: 'region-1' });

    expect(result.map((warehouse) => warehouse.id)).toEqual(['wh-1', 'wh-2', 'wh-3']);
  });
});

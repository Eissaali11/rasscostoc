import { describe, expect, it, vi } from 'vitest';
import type { SupervisorWarehouse } from "@shared/schema";
import type { ISupervisorWarehouseAssignmentsRepository } from '../contracts/ISupervisorWarehouseAssignmentsRepository';
import { SupervisorWarehouseAssignmentsUseCase } from './SupervisorWarehouseAssignments.use-case';

type MockRepo = {
  [K in keyof ISupervisorWarehouseAssignmentsRepository]: ReturnType<typeof vi.fn>;
};

function createMockRepo(): MockRepo {
  return {
    getSupervisorWarehouses: vi.fn(),
    assignWarehouseToSupervisor: vi.fn(),
    removeWarehouseFromSupervisor: vi.fn(),
  };
}

function warehouseAssignmentFixture(overrides: Partial<SupervisorWarehouse> = {}): SupervisorWarehouse {
  return {
    id: 'assignment-1',
    supervisorId: 'sup-1',
    warehouseId: 'wh-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SupervisorWarehouseAssignmentsUseCase', () => {
  it('maps assigned warehouses to ids while preserving order for legacy facade compatibility', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorWarehouseAssignmentsUseCase(repo);

    repo.getSupervisorWarehouses.mockResolvedValue([
      warehouseAssignmentFixture({ id: 'assignment-2', warehouseId: 'wh-2' }),
      warehouseAssignmentFixture({ id: 'assignment-1', warehouseId: 'wh-1' }),
    ]);

    const result = await useCase.getAssignedWarehouseIds('sup-1');

    expect(result).toEqual(['wh-2', 'wh-1']);
    expect(repo.getSupervisorWarehouses).toHaveBeenCalledWith('sup-1');
  });

  it('delegates successful warehouse assignment', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorWarehouseAssignmentsUseCase(repo);
    const assignment = warehouseAssignmentFixture();
    repo.assignWarehouseToSupervisor.mockResolvedValue(assignment);

    const result = await useCase.assignWarehouse('sup-1', 'wh-1');

    expect(result).toEqual(assignment);
    expect(repo.assignWarehouseToSupervisor).toHaveBeenCalledWith('sup-1', 'wh-1');
  });

  it('throws when assigning an already assigned warehouse (edge case)', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorWarehouseAssignmentsUseCase(repo);
    repo.assignWarehouseToSupervisor.mockRejectedValue(
      new Error('Warehouse is already assigned to this supervisor')
    );

    await expect(useCase.assignWarehouse('sup-1', 'wh-1')).rejects.toThrow(
      'Warehouse is already assigned to this supervisor'
    );
  });

  it('returns false when removing a non-existent assignment (edge case)', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorWarehouseAssignmentsUseCase(repo);
    repo.removeWarehouseFromSupervisor.mockResolvedValue(false);

    const result = await useCase.removeWarehouse('sup-1', 'wh-missing');

    expect(result).toBe(false);
    expect(repo.removeWarehouseFromSupervisor).toHaveBeenCalledWith('sup-1', 'wh-missing');
  });
});

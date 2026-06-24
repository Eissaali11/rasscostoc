import { describe, expect, it, vi } from 'vitest';
import type { SupervisorTechnician, SupervisorWarehouse, UserSafe } from "@shared/schema";
import type { ISupervisorAssignmentsRepository } from '../contracts/ISupervisorAssignmentsRepository';
import { SupervisorAssignmentsUseCase } from './SupervisorAssignments.use-case';

type MockRepo = {
  [K in keyof ISupervisorAssignmentsRepository]: ReturnType<typeof vi.fn>;
};

function createMockRepo(): MockRepo {
  return {
    getSupervisorTechnicians: vi.fn(),
    assignTechnicianToSupervisor: vi.fn(),
    removeTechnicianFromSupervisor: vi.fn(),
    getSupervisorWarehouses: vi.fn(),
    assignWarehouseToSupervisor: vi.fn(),
    removeWarehouseFromSupervisor: vi.fn(),
  };
}

function technicianFixture(overrides: Partial<UserSafe> = {}): UserSafe {
  return {
    id: 'tech-1',
    username: 'tech1',
    email: 'tech1@example.com',
    fullName: 'Tech One',
    profileImage: null,
    city: null,
    role: 'technician',
    regionId: 'region-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function assignmentFixture(overrides: Partial<SupervisorTechnician> = {}): SupervisorTechnician {
  return {
    id: 'assignment-1',
    supervisorId: 'sup-1',
    technicianId: 'tech-1',
    createdAt: new Date(),
    ...overrides,
  };
}

function warehouseAssignmentFixture(overrides: Partial<SupervisorWarehouse> = {}): SupervisorWarehouse {
  return {
    id: 'warehouse-assignment-1',
    supervisorId: 'sup-1',
    warehouseId: 'wh-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SupervisorAssignmentsUseCase', () => {
  it('returns technician ids in same repository order', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.getSupervisorTechnicians.mockResolvedValue([
      technicianFixture({ id: 'tech-2' }),
      technicianFixture({ id: 'tech-1' }),
    ]);

    const result = await useCase.getTechnicianIdsBySupervisor('sup-1');

    expect(result).toEqual(['tech-2', 'tech-1']);
    expect(repo.getSupervisorTechnicians).toHaveBeenCalledWith('sup-1');
  });

  it('delegates assign operation to repository', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    const assignment = assignmentFixture();
    repo.assignTechnicianToSupervisor.mockResolvedValue(assignment);

    const result = await useCase.assignTechnician('sup-1', 'tech-1');

    expect(result).toEqual(assignment);
    expect(repo.assignTechnicianToSupervisor).toHaveBeenCalledWith('sup-1', 'tech-1');
  });

  it('delegates remove operation to repository', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.removeTechnicianFromSupervisor.mockResolvedValue(true);

    const result = await useCase.removeTechnician('sup-1', 'tech-1');

    expect(result).toBe(true);
    expect(repo.removeTechnicianFromSupervisor).toHaveBeenCalledWith('sup-1', 'tech-1');
  });

  it('propagates repository error during assignment', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.assignTechnicianToSupervisor.mockRejectedValue(new Error('duplicate-assignment'));

    await expect(useCase.assignTechnician('sup-1', 'tech-1')).rejects.toThrow('duplicate-assignment');
  });

  it('returns warehouse ids in same repository order', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.getSupervisorWarehouses.mockResolvedValue([
      warehouseAssignmentFixture({ warehouseId: 'wh-2' }),
      warehouseAssignmentFixture({ id: 'warehouse-assignment-2', warehouseId: 'wh-1' }),
    ]);

    const result = await useCase.getWarehouseIdsBySupervisor('sup-1');

    expect(result).toEqual(['wh-2', 'wh-1']);
    expect(repo.getSupervisorWarehouses).toHaveBeenCalledWith('sup-1');
  });

  it('delegates assign warehouse operation to repository', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    const assignment = warehouseAssignmentFixture();
    repo.assignWarehouseToSupervisor.mockResolvedValue(assignment);

    const result = await useCase.assignWarehouse('sup-1', 'wh-1');

    expect(result).toEqual(assignment);
    expect(repo.assignWarehouseToSupervisor).toHaveBeenCalledWith('sup-1', 'wh-1');
  });

  it('delegates remove warehouse operation to repository', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.removeWarehouseFromSupervisor.mockResolvedValue(true);

    const result = await useCase.removeWarehouse('sup-1', 'wh-1');

    expect(result).toBe(true);
    expect(repo.removeWarehouseFromSupervisor).toHaveBeenCalledWith('sup-1', 'wh-1');
  });

  it('propagates repository error during warehouse assignment', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorAssignmentsUseCase(repo);
    repo.assignWarehouseToSupervisor.mockRejectedValue(new Error('duplicate-warehouse-assignment'));

    await expect(useCase.assignWarehouse('sup-1', 'wh-1')).rejects.toThrow('duplicate-warehouse-assignment');
  });
});

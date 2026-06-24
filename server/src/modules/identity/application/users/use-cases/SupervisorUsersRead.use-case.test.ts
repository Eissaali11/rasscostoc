import { describe, expect, it, vi } from 'vitest';
import type {
  TechnicianFixedInventory,
  TechnicianInventory,
  UserSafe,
} from "@shared/schema";
import type { ISupervisorUsersReadRepository } from '../contracts/ISupervisorUsersReadRepository';
import {
  SupervisorUsersReadUseCase,
  SupervisorUsersReadUseCaseError,
} from './SupervisorUsersRead.use-case';

type MockRepo = {
  [K in keyof ISupervisorUsersReadRepository]: ReturnType<typeof vi.fn>;
};

function createMockRepo(): MockRepo {
  return {
    getUserById: vi.fn(),
    getTechnicianFixedInventory: vi.fn(),
    getTechnicianMovingInventory: vi.fn(),
  };
}

function userFixture(overrides: Partial<UserSafe> = {}): UserSafe {
  return {
    id: 'user-1',
    username: 'tech-1',
    email: 'tech-1@example.com',
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

function fixedInventoryFixture(overrides: Partial<TechnicianFixedInventory> = {}): TechnicianFixedInventory {
  return {
    id: 'fixed-1',
    technicianId: 'user-1',
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
    lebaraBoxes: 0,
    lebaraUnits: 0,
    lowStockThreshold: 30,
    criticalStockThreshold: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SupervisorUsersReadUseCase', () => {
  it('returns user details when target user is in supervisor region', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorUsersReadUseCase(repo);
    const user = userFixture({ regionId: 'region-1' });
    repo.getUserById.mockResolvedValue(user);

    const result = await useCase.getUserDetails({
      supervisorRegionId: 'region-1',
      targetUserId: 'user-1',
    });

    expect(result.id).toBe('user-1');
    expect(repo.getUserById).toHaveBeenCalledWith('user-1');
  });

  it('throws 404 for user details when target user does not exist', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorUsersReadUseCase(repo);
    repo.getUserById.mockResolvedValue(undefined);

    await expect(
      useCase.getUserDetails({
        supervisorRegionId: 'region-1',
        targetUserId: 'missing-user',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    } as Partial<SupervisorUsersReadUseCaseError>);
  });

  it('throws 403 for fixed inventory when target user is missing (legacy behavior)', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorUsersReadUseCase(repo);
    repo.getUserById.mockResolvedValue(undefined);

    await expect(
      useCase.getUserFixedInventory({
        supervisorRegionId: 'region-1',
        targetUserId: 'missing-user',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'لا يمكنك الوصول إلى مستخدمين خارج منطقتك',
    } as Partial<SupervisorUsersReadUseCaseError>);
  });

  it('returns fixed inventory with technician metadata and city fallback', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorUsersReadUseCase(repo);
    repo.getUserById.mockResolvedValue(userFixture({ city: null, fullName: 'Technician Name' }));
    repo.getTechnicianFixedInventory.mockResolvedValue(fixedInventoryFixture({ id: 'fixed-42' }));

    const result = await useCase.getUserFixedInventory({
      supervisorRegionId: 'region-1',
      targetUserId: 'user-1',
    });

    expect(result?.id).toBe('fixed-42');
    expect(result?.technicianName).toBe('Technician Name');
    expect(result?.city).toBe('غير محدد');
  });

  it('returns null when moving inventory does not exist', async () => {
    const repo = createMockRepo();
    const useCase = new SupervisorUsersReadUseCase(repo);
    repo.getUserById.mockResolvedValue(userFixture());
    repo.getTechnicianMovingInventory.mockResolvedValue(undefined as TechnicianInventory | undefined);

    const result = await useCase.getUserMovingInventory({
      supervisorRegionId: 'region-1',
      targetUserId: 'user-1',
    });

    expect(result).toBeNull();
  });
});
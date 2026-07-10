import { describe, expect, it, vi } from 'vitest';
import type { InventoryRequest } from "@shared/schema";
import type { IInventoryRequestsManagementRepository } from '../contracts/IInventoryRequestsManagementRepository';
import {
  InventoryRequestsManagementUseCase,
  InventoryRequestsManagementUseCaseError,
} from './InventoryRequestsManagement.use-case';

type MockRepository = {
  [K in keyof IInventoryRequestsManagementRepository]: ReturnType<typeof vi.fn>;
};

function createRepositoryMock(): MockRepository {
  return {
    updateStatus: vi.fn(),
    deleteById: vi.fn(),
  };
}

function inventoryRequestFixture(overrides: Partial<InventoryRequest> = {}): InventoryRequest {
  return {
    id: 'req-1',
    technicianId: 'tech-1',
    warehouseId: null,
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
    notes: null,
    status: 'pending',
    adminNotes: null,
    respondedBy: null,
    respondedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('InventoryRequestsManagementUseCase', () => {
  it('rejects invalid status with 400 and same message', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsManagementUseCase(repository);

    await expect(
      useCase.updateStatus({
        id: 'req-1',
        status: 'pending',
        respondedBy: 'admin-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid status. Must be 'approved' or 'rejected'",
    } satisfies Partial<InventoryRequestsManagementUseCaseError>);
  });

  it('updates status successfully via repository', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsManagementUseCase(repository);
    repository.updateStatus.mockResolvedValue(
      inventoryRequestFixture({ id: 'req-2', status: 'approved', respondedBy: 'admin-1' }),
    );

    const result = await useCase.updateStatus({
      id: 'req-2',
      status: 'approved',
      respondedBy: 'admin-1',
      adminNotes: 'ok',
    });

    expect(result.id).toBe('req-2');
    expect(result.status).toBe('approved');
    expect(repository.updateStatus).toHaveBeenCalledWith({
      id: 'req-2',
      status: 'approved',
      respondedBy: 'admin-1',
      adminNotes: 'ok',
    });
  });

  it('maps repository not-found error to 404 response error', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsManagementUseCase(repository);
    repository.updateStatus.mockRejectedValue(new Error('Inventory request with id req-missing not found'));

    await expect(
      useCase.updateStatus({
        id: 'req-missing',
        status: 'rejected',
        respondedBy: 'admin-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Inventory request not found',
    } satisfies Partial<InventoryRequestsManagementUseCaseError>);
  });

  it('throws 404 when delete target does not exist', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsManagementUseCase(repository);
    repository.deleteById.mockResolvedValue(false);

    await expect(useCase.deleteRequest('req-missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Inventory request not found',
    } satisfies Partial<InventoryRequestsManagementUseCaseError>);
  });

  it('deletes request when target exists', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsManagementUseCase(repository);
    repository.deleteById.mockResolvedValue(true);

    await expect(useCase.deleteRequest('req-1')).resolves.toBeUndefined();
    expect(repository.deleteById).toHaveBeenCalledWith('req-1');
  });
});

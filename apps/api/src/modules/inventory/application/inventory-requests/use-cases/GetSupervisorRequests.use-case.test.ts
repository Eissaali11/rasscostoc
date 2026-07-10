import { describe, expect, it, vi } from 'vitest';
import type { IInventoryRequestsRepository } from '../contracts/IInventoryRequestsRepository';
import { GetSupervisorRequestsUseCase } from './GetSupervisorRequests.use-case';

type MockRepository = {
  [K in keyof IInventoryRequestsRepository]: ReturnType<typeof vi.fn>;
};

function createRepositoryMock(): MockRepository {
  return {
    getInventoryRequests: vi.fn(),
    createInventoryRequest: vi.fn(),
    updateInventoryRequest: vi.fn(),
    deleteInventoryRequest: vi.fn(),
    getSupervisorRequestsByRegion: vi.fn(),
  };
}

describe('GetSupervisorRequestsUseCase', () => {
  it('throws error if regionId is empty', async () => {
    const repository = createRepositoryMock();
    const useCase = new GetSupervisorRequestsUseCase(repository);

    await expect(useCase.execute('')).rejects.toThrow('Region ID is required');
  });

  it('calls repository with correct arguments', async () => {
    const repository = createRepositoryMock();
    const useCase = new GetSupervisorRequestsUseCase(repository);
    repository.getSupervisorRequestsByRegion.mockResolvedValue([{ id: 'req-1' }]);

    const result = await useCase.execute('region-1', 'pending');

    expect(result).toEqual([{ id: 'req-1' }]);
    expect(repository.getSupervisorRequestsByRegion).toHaveBeenCalledWith('region-1', 'pending');
  });
});

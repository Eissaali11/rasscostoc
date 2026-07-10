import { describe, expect, it, vi } from 'vitest';
import type { IRegionRepository } from '../contracts/IRegionRepository';
import { GetRegionsWithStatsUseCase } from './GetRegionsWithStats.use-case';

function createRepositoryMock(): IRegionRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countUsersByRegionId: vi.fn(),
    countWarehousesByRegionId: vi.fn(),
    getInventoryStatsByRegionId: vi.fn(),
  };
}

describe('GetRegionsWithStatsUseCase', () => {
  it('returns regions with aggregated inventory stats', async () => {
    const repo = createRepositoryMock();

    (repo.findAll as any).mockResolvedValue([
      {
        id: 'region-1',
        name: 'R1',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'region-2',
        name: 'R2',
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    (repo.getInventoryStatsByRegionId as any)
      .mockResolvedValueOnce({ itemCount: 4, totalQuantity: 100, lowStockCount: 1 })
      .mockResolvedValueOnce({ itemCount: 0, totalQuantity: 0, lowStockCount: 0 });

    const useCase = new GetRegionsWithStatsUseCase(repo);
    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'region-1', itemCount: 4, totalQuantity: 100, lowStockCount: 1 });
    expect(result[1]).toMatchObject({ id: 'region-2', itemCount: 0, totalQuantity: 0, lowStockCount: 0 });
    expect(repo.getInventoryStatsByRegionId).toHaveBeenCalledTimes(2);
  });
});

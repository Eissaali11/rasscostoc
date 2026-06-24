import { describe, expect, it, vi } from 'vitest';
import type { IRegionRepository } from '../contracts/IRegionRepository';
import { DeleteRegionUseCase } from './DeleteRegion.use-case';

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

describe('DeleteRegionUseCase', () => {
  it('fails gracefully when region has users', async () => {
    const repo = createRepositoryMock();
    (repo.countUsersByRegionId as any).mockResolvedValue(2);
    (repo.countWarehousesByRegionId as any).mockResolvedValue(0);

    const useCase = new DeleteRegionUseCase(repo);

    await expect(useCase.execute('region-1')).rejects.toThrow(
      'Cannot delete region with existing users or warehouses',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('fails gracefully when region has warehouses', async () => {
    const repo = createRepositoryMock();
    (repo.countUsersByRegionId as any).mockResolvedValue(0);
    (repo.countWarehousesByRegionId as any).mockResolvedValue(1);

    const useCase = new DeleteRegionUseCase(repo);

    await expect(useCase.execute('region-1')).rejects.toThrow(
      'Cannot delete region with existing users or warehouses',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes region when no users and warehouses are attached', async () => {
    const repo = createRepositoryMock();
    (repo.countUsersByRegionId as any).mockResolvedValue(0);
    (repo.countWarehousesByRegionId as any).mockResolvedValue(0);
    (repo.delete as any).mockResolvedValue(true);

    const useCase = new DeleteRegionUseCase(repo);
    const result = await useCase.execute('region-1');

    expect(result).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('region-1');
  });
});

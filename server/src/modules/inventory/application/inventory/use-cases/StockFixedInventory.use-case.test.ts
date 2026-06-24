import { describe, expect, it, vi } from 'vitest';
import type { IStockFixedInventoryRepository } from '../contracts/IStockFixedInventoryRepository';
import { StockFixedInventoryUseCase } from './StockFixedInventory.use-case';

function createRepositoryMock(): IStockFixedInventoryRepository {
  return {
    getTechnicianFixedInventory: vi.fn(),
    updateTechnicianFixedInventory: vi.fn(),
    deleteTechnicianFixedInventory: vi.fn(),
  };
}

describe('StockFixedInventoryUseCase', () => {
  it('gets technician fixed inventory by technician id', async () => {
    const repository = createRepositoryMock();
    const useCase = new StockFixedInventoryUseCase(repository);
    const inventory = { id: 'inv-1', technicianId: 'tech-1' } as any;

    vi.mocked(repository.getTechnicianFixedInventory).mockResolvedValue(inventory);

    const result = await useCase.getByTechnicianId('tech-1');

    expect(repository.getTechnicianFixedInventory).toHaveBeenCalledWith('tech-1');
    expect(result).toEqual(inventory);
  });

  it('updates technician fixed inventory by technician id', async () => {
    const repository = createRepositoryMock();
    const useCase = new StockFixedInventoryUseCase(repository);
    const updates = { n950Boxes: 5 } as any;
    const updated = { id: 'inv-1', technicianId: 'tech-1', n950Boxes: 5 } as any;

    vi.mocked(repository.updateTechnicianFixedInventory).mockResolvedValue(updated);

    const result = await useCase.updateByTechnicianId('tech-1', updates);

    expect(repository.updateTechnicianFixedInventory).toHaveBeenCalledWith('tech-1', updates);
    expect(result).toEqual(updated);
  });

  it('deletes technician fixed inventory by technician id', async () => {
    const repository = createRepositoryMock();
    const useCase = new StockFixedInventoryUseCase(repository);

    vi.mocked(repository.deleteTechnicianFixedInventory).mockResolvedValue(true);

    const result = await useCase.deleteByTechnicianId('tech-1');

    expect(repository.deleteTechnicianFixedInventory).toHaveBeenCalledWith('tech-1');
    expect(result).toBe(true);
  });
});

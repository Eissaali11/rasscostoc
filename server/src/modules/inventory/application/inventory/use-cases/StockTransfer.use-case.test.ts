import { describe, expect, it, vi } from 'vitest';
import type {
  IStockTransferRepository,
  StockTransferInput,
  StockTransferOutput,
} from '../contracts/IStockTransferRepository';
import { StockTransferUseCase } from './StockTransfer.use-case';

function createRepositoryMock(): IStockTransferRepository {
  return {
    transferStock: vi.fn(),
    getStockMovements: vi.fn(),
  };
}

describe('StockTransferUseCase', () => {
  it('transfers stock through repository', async () => {
    const repository = createRepositoryMock();
    const useCase = new StockTransferUseCase(repository);
    const input: StockTransferInput = {
      technicianId: 'tech-1',
      itemType: 'item-1',
      packagingType: 'box',
      quantity: 3,
      fromInventory: 'fixed',
      toInventory: 'moving',
      performedBy: 'admin-1',
    };

    const output: StockTransferOutput = {
      movement: { id: 'mv-1', technicianId: 'tech-1' } as any,
      updatedInventory: { id: 'inv-1', technicianId: 'tech-1' } as any,
    };

    vi.mocked(repository.transferStock).mockResolvedValue(output);

    const result = await useCase.transfer(input);

    expect(repository.transferStock).toHaveBeenCalledWith(input);
    expect(result).toEqual(output);
  });

  it('gets stock movements through repository', async () => {
    const repository = createRepositoryMock();
    const useCase = new StockTransferUseCase(repository);
    const movements = [{ id: 'mv-1', itemType: 'item-1' }] as any;

    vi.mocked(repository.getStockMovements).mockResolvedValue(movements);

    const result = await useCase.getMovements();

    expect(repository.getStockMovements).toHaveBeenCalledOnce();
    expect(result).toEqual(movements);
  });
});

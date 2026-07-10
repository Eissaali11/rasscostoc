import { describe, expect, it, vi } from 'vitest';
import { InventoryEntriesMigrationUseCase } from './InventoryEntriesMigration.use-case';

describe('InventoryEntriesMigrationUseCase', () => {
  it('completes successfully and logs current no-op migration message', async () => {
    const useCase = new InventoryEntriesMigrationUseCase();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith('Migration handled by Repository Pattern - Modern architecture in use');

    spy.mockRestore();
  });
});

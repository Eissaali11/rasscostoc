import { describe, expect, it, vi } from 'vitest';
import { ExportSystemBackupUseCase } from './ExportSystemBackup.use-case';

vi.mock('@core/database/connection', () => {
  return {
    getDatabase: () => ({
      select: () => ({
        from: () => []
      })
    })
  };
});

vi.mock('../../adapters/identity/identity-ports.registry', () => {
  return {
    getInventoryIdentityPorts: () => ({
      getAllUsersForBackup: async () => [],
    }),
  };
});

describe('ExportSystemBackupUseCase', () => {
  it('exports backup data structure successfully', async () => {
    const useCase = new ExportSystemBackupUseCase();
    const result = await useCase.execute();

    expect(result).toHaveProperty('exportedAt');
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('users');
    expect(result.data).toHaveProperty('regions');
  });
});

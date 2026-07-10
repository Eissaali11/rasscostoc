import { describe, expect, it, vi } from 'vitest';
import type { ISystemLogsRepository } from '../contracts/ISystemLogsRepository';
import type { SystemLog } from "@shared/schema";
import { GetSystemLogsUseCase } from './GetSystemLogs.use-case';

function createRepositoryMock(): ISystemLogsRepository {
  return {
    getSystemLogs: vi.fn(),
    createSystemLog: vi.fn(),
  };
}

describe('GetSystemLogsUseCase', () => {
  it('uses default pagination when filters are missing', async () => {
    const repository = createRepositoryMock();
    (repository.getSystemLogs as any).mockResolvedValue([] satisfies SystemLog[]);

    const useCase = new GetSystemLogsUseCase(repository);
    await useCase.execute();

    expect(repository.getSystemLogs).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
    });
  });

  it('computes offset from page when offset is not provided', async () => {
    const repository = createRepositoryMock();
    (repository.getSystemLogs as any).mockResolvedValue([] satisfies SystemLog[]);

    const useCase = new GetSystemLogsUseCase(repository);
    await useCase.execute({ page: 3, limit: 20, action: 'create' });

    expect(repository.getSystemLogs).toHaveBeenCalledWith({
      action: 'create',
      limit: 20,
      offset: 40,
    });
  });

  it('prefers explicit offset over page-derived offset', async () => {
    const repository = createRepositoryMock();
    (repository.getSystemLogs as any).mockResolvedValue([] satisfies SystemLog[]);

    const useCase = new GetSystemLogsUseCase(repository);
    await useCase.execute({ page: 4, limit: 25, offset: 10, severity: 'warning' });

    expect(repository.getSystemLogs).toHaveBeenCalledWith({
      severity: 'warning',
      limit: 25,
      offset: 10,
    });
  });
});

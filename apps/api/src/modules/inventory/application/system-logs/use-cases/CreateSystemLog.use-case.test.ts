import { describe, expect, it, vi } from 'vitest';
import type { ISystemLogsRepository } from '../contracts/ISystemLogsRepository';
import type { InsertSystemLog, SystemLog } from "@shared/schema";
import { CreateSystemLogUseCase } from './CreateSystemLog.use-case';

function createRepositoryMock(): ISystemLogsRepository {
  return {
    getSystemLogs: vi.fn(),
    createSystemLog: vi.fn(),
  };
}

describe('CreateSystemLogUseCase', () => {
  it('delegates log creation to repository', async () => {
    const repository = createRepositoryMock();
    const input: InsertSystemLog = {
      userId: 'user-1',
      userName: 'User One',
      userRole: 'admin',
      action: 'create',
      entityType: 'inventory',
      description: 'created inventory item',
      entityId: 'entity-1',
      entityName: null,
      details: JSON.stringify({ test: true }),
      severity: 'info',
      success: true,
      regionId: null,
    };

    const createdLog = {
      id: 'log-1',
      createdAt: new Date(),
      userId: input.userId ?? null,
      userName: input.userName,
      userRole: input.userRole,
      regionId: input.regionId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityName: input.entityName ?? null,
      details: input.details ?? null,
      description: input.description,
      severity: input.severity ?? 'info',
      success: input.success ?? true,
    } satisfies SystemLog;

    (repository.createSystemLog as any).mockResolvedValue(createdLog);

    const useCase = new CreateSystemLogUseCase(repository);
    const result = await useCase.execute(input);

    expect(result).toEqual(createdLog);
    expect(repository.createSystemLog).toHaveBeenCalledWith(input);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { IBootstrapDefaultsRepository } from '../contracts/IBootstrapDefaultsRepository';
import { BootstrapDefaultsUseCase } from './BootstrapDefaults.use-case';

function createRepositoryMock(): IBootstrapDefaultsRepository {
  return {
    getUsers: vi.fn(),
    getRegions: vi.fn(),
    createRegion: vi.fn(),
    createUser: vi.fn(),
    seedDefaultItemTypes: vi.fn(),
  };
}

describe('BootstrapDefaultsUseCase', () => {
  it('creates default region and users when no users exist', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);
    const hashPassword = vi.fn(async (value: string) => `hashed-${value}`);

    vi.mocked(repository.getUsers).mockResolvedValue([]);
    vi.mocked(repository.getRegions).mockResolvedValue([]);
    vi.mocked(repository.createRegion).mockResolvedValue({ id: 'region-1' } as any);
    vi.mocked(repository.createUser).mockResolvedValue({ id: 'user-1' } as any);

    const result = await useCase.execute(hashPassword);

    expect(repository.createRegion).toHaveBeenCalledOnce();
    expect(repository.createUser).toHaveBeenCalledTimes(3);
    expect(hashPassword).toHaveBeenCalledTimes(3);
    expect(repository.seedDefaultItemTypes).not.toHaveBeenCalled();
    expect(result).toEqual({ createdUsers: true, createdRegion: true });
  });

  it('skips default users creation when users already exist', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);
    const hashPassword = vi.fn(async (value: string) => `hashed-${value}`);

    vi.mocked(repository.getUsers).mockResolvedValue([{ id: 'user-existing' } as any]);

    const result = await useCase.execute(hashPassword);

    expect(repository.getRegions).not.toHaveBeenCalled();
    expect(repository.createRegion).not.toHaveBeenCalled();
    expect(repository.createUser).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(repository.seedDefaultItemTypes).not.toHaveBeenCalled();
    expect(result).toEqual({ createdUsers: false, createdRegion: false });
  });
});

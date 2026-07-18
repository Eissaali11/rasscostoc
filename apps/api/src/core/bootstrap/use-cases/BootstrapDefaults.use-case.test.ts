import { describe, expect, it, vi } from 'vitest';
import type { IBootstrapDefaultsRepository } from '../contracts/IBootstrapDefaultsRepository';
import {
  assertSafeBootstrapPassword,
  BootstrapAdminRequiredError,
  BootstrapDefaultsUseCase,
} from './BootstrapDefaults.use-case';

function createRepositoryMock(): IBootstrapDefaultsRepository {
  return {
    getUsers: vi.fn(),
    getRegions: vi.fn(),
    createRegion: vi.fn(),
    createUser: vi.fn(),
    seedDefaultItemTypes: vi.fn(),
  };
}

describe('assertSafeBootstrapPassword', () => {
  it('rejects missing, short, and known default passwords', () => {
    expect(() => assertSafeBootstrapPassword(undefined)).toThrow(BootstrapAdminRequiredError);
    expect(() => assertSafeBootstrapPassword('short')).toThrow(BootstrapAdminRequiredError);
    expect(() => assertSafeBootstrapPassword('admin123')).toThrow(BootstrapAdminRequiredError);
  });

  it('accepts a strong password', () => {
    expect(assertSafeBootstrapPassword('Str0ng-Bootstrap!')).toBe('Str0ng-Bootstrap!');
  });
});

describe('BootstrapDefaultsUseCase', () => {
  it('creates only first admin when empty DB and BOOTSTRAP_ADMIN_PASSWORD is set', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);
    const hashPassword = vi.fn(async (value: string) => `hashed-${value}`);

    vi.mocked(repository.getUsers).mockResolvedValue([]);
    vi.mocked(repository.getRegions).mockResolvedValue([]);
    vi.mocked(repository.createRegion).mockResolvedValue({ id: 'region-1' } as any);
    vi.mocked(repository.createUser).mockResolvedValue({ id: 'user-1' } as any);

    const result = await useCase.execute(hashPassword, {
      BOOTSTRAP_ADMIN_PASSWORD: 'Str0ng-Bootstrap!',
      BOOTSTRAP_ADMIN_USERNAME: 'ops-admin',
    });

    expect(repository.createRegion).toHaveBeenCalledOnce();
    expect(repository.createUser).toHaveBeenCalledTimes(1);
    expect(repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'ops-admin',
        role: 'admin',
        password: 'hashed-Str0ng-Bootstrap!',
      }),
    );
    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ createdUsers: true, createdRegion: true });
  });

  it('fails closed when empty DB and no bootstrap password', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);
    const hashPassword = vi.fn(async (value: string) => `hashed-${value}`);

    vi.mocked(repository.getUsers).mockResolvedValue([]);

    await expect(useCase.execute(hashPassword, {})).rejects.toBeInstanceOf(
      BootstrapAdminRequiredError,
    );
    expect(repository.createUser).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('rejects admin123 even if provided', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);

    vi.mocked(repository.getUsers).mockResolvedValue([]);

    await expect(
      useCase.execute(async (v) => v, { BOOTSTRAP_ADMIN_PASSWORD: 'admin123' }),
    ).rejects.toBeInstanceOf(BootstrapAdminRequiredError);
  });

  it('skips bootstrap when users already exist', async () => {
    const repository = createRepositoryMock();
    const useCase = new BootstrapDefaultsUseCase(repository);
    const hashPassword = vi.fn(async (value: string) => `hashed-${value}`);

    vi.mocked(repository.getUsers).mockResolvedValue([{ id: 'user-existing' } as any]);

    const result = await useCase.execute(hashPassword, {});

    expect(repository.getRegions).not.toHaveBeenCalled();
    expect(repository.createRegion).not.toHaveBeenCalled();
    expect(repository.createUser).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(result).toEqual({ createdUsers: false, createdRegion: false });
  });
});

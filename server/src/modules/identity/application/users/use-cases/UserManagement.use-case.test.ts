import { describe, expect, it, vi } from 'vitest';
import type { InsertUser, User, UserSafe } from "@shared/schema";
import type { IUserRepository } from '../contracts/IUserRepository';
import { UserManagementUseCase } from './UserManagement.use-case';

type MockRepo = {
  [K in keyof IUserRepository]: ReturnType<typeof vi.fn>;
};

function createMockRepo(): MockRepo {
  return {
    getUsers: vi.fn(),
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    getUsersByRole: vi.fn(),
    getUsersByRegion: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  };
}

function safeUserFixture(overrides: Partial<UserSafe> = {}): UserSafe {
  return {
    id: 'u-1',
    username: 'user1',
    email: 'user1@example.com',
    fullName: 'User One',
    profileImage: null,
    city: null,
    role: 'technician',
    regionId: 'r-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fullUserFixture(overrides: Partial<User> = {}): User {
  return {
    ...safeUserFixture(),
    password: '$2b$10$hash',
    ...overrides,
  } as User;
}

describe('UserManagementUseCase', () => {
  it('finds user by username for auth without mutating input', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    const user = fullUserFixture({ username: 'auth_user' });
    repo.getUserByUsername.mockResolvedValue(user);

    const result = await useCase.findByUsername('auth_user');

    expect(result?.username).toBe('auth_user');
    expect(repo.getUserByUsername).toHaveBeenCalledWith('auth_user');
  });

  it('returns undefined when username lookup does not match (auth edge case)', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    repo.getUserByUsername.mockResolvedValue(undefined);

    const result = await useCase.findByUsername('unknown-user');

    expect(result).toBeUndefined();
    expect(repo.getUserByUsername).toHaveBeenCalledTimes(1);
  });

  it('returns region users list', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    const users = [safeUserFixture(), safeUserFixture({ id: 'u-2' })];
    repo.getUsersByRegion.mockResolvedValue(users);

    const result = await useCase.findByRegion('r-1');

    expect(result).toHaveLength(2);
    expect(repo.getUsersByRegion).toHaveBeenCalledWith('r-1');
  });

  it('returns role users list', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    const users = [safeUserFixture({ role: 'admin' })];
    repo.getUsersByRole.mockResolvedValue(users);

    const result = await useCase.findByRole('admin');

    expect(result).toHaveLength(1);
    expect(repo.getUsersByRole).toHaveBeenCalledWith('admin');
  });

  it('creates user using repository contract', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    const input: InsertUser = {
      username: 'new-user',
      email: 'new-user@example.com',
      password: '$2b$10$hash',
      fullName: 'New User',
      profileImage: null,
      city: null,
      role: 'technician',
      regionId: 'r-1',
      isActive: true,
    };
    const created = safeUserFixture({ username: 'new-user' });
    repo.createUser.mockResolvedValue(created);

    const result = await useCase.create(input);

    expect(result.username).toBe('new-user');
    expect(repo.createUser).toHaveBeenCalledWith(input);
  });

  it('updates user using repository contract', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    const updated = safeUserFixture({ fullName: 'Updated Name' });
    repo.updateUser.mockResolvedValue(updated);

    const result = await useCase.update('u-1', { fullName: 'Updated Name' });

    expect(result.fullName).toBe('Updated Name');
    expect(repo.updateUser).toHaveBeenCalledWith('u-1', { fullName: 'Updated Name' });
  });

  it('soft deletes user using repository contract', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    repo.deleteUser.mockResolvedValue(true);

    const result = await useCase.softDelete('u-1');

    expect(result).toBe(true);
    expect(repo.deleteUser).toHaveBeenCalledWith('u-1');
  });

  it('propagates repository failure during auth username lookup', async () => {
    const repo = createMockRepo();
    const useCase = new UserManagementUseCase(repo);
    repo.getUserByUsername.mockRejectedValue(new Error('db unavailable'));

    await expect(useCase.findByUsername('auth_user')).rejects.toThrow('db unavailable');
  });
});

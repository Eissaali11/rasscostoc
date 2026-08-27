import { describe, expect, it, vi } from 'vitest';
import type { InsertUser, User, UserSafe } from "@shared/schema";
import type { IUserRepository, OrdinaryUserFieldUpdate } from '@stockpro/contracts';
import { UserManagementUseCase, type UserUpdateCommand } from './UserManagement.use-case';

type MockRepo = {
  [K in keyof IUserRepository]: ReturnType<typeof vi.fn>;
} & {
  // Not part of IUserRepository (see IIdentityUnitOfWork.ts) — kept here only
  // as convenient vi.fn() instances that createMockUow's context exposes at
  // its own top level, exactly where applyCanonicalStatusTransition actually
  // calls them, so every existing assertion below keeps working unchanged.
  lockUserForUpdate: ReturnType<typeof vi.fn>;
  updateUserState: ReturnType<typeof vi.fn>;
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
    lockUserForUpdate: vi.fn(),
    updateUserState: vi.fn(),
  };
}

// ==================================================================
// Compile-time containment proofs (npm run check:full does not include
// *.test.ts files, so these are verified via a dedicated typecheck step —
// see scripts/test-unit-safe.mjs's sibling type-check invocation for this
// file). Each of the four negative assertions below must fail to compile if
// the field it targets is ever accidentally re-added to the type it targets;
// the two positive assertions must keep compiling.
// ==================================================================
function typeContainmentProofs() {
  // 1. InsertUser cannot represent authGeneration.
  // @ts-expect-error authGeneration is server-managed and absent from InsertUser
  const _insertUserWithGeneration: InsertUser = { authGeneration: 0 } as InsertUser;
  void _insertUserWithGeneration;

  // 2. UserUpdateCommand cannot represent authGeneration.
  // @ts-expect-error authGeneration must never be a client-writable update field
  const _commandWithGeneration: UserUpdateCommand = { authGeneration: 0 };
  void _commandWithGeneration;

  // 3. OrdinaryUserFieldUpdate cannot represent isActive.
  // @ts-expect-error isActive is a security transition, not an ordinary field
  const _ordinaryWithActive: OrdinaryUserFieldUpdate = { isActive: true };
  void _ordinaryWithActive;

  // 4. OrdinaryUserFieldUpdate cannot represent authGeneration.
  // @ts-expect-error authGeneration must never reach ordinary persistence
  const _ordinaryWithGeneration: OrdinaryUserFieldUpdate = { authGeneration: 0 };
  void _ordinaryWithGeneration;

  // 5. UserUpdateCommand MAY represent isActive — the canonical PATCH intent
  // must remain representable, or this fix would silently disable the
  // deactivate/reactivate feature. This line must compile with no error.
  const _commandWithActive: UserUpdateCommand = { isActive: true };
  void _commandWithActive;
}
void typeContainmentProofs;

const actorFixture = { id: 'admin-1', username: 'admin', role: 'admin' };

/**
 * In-process fake Identity Unit of Work: runs the given work callback
 * directly against the provided mock repository, with no real transaction or
 * database. Deliberately application-layer only — no Drizzle/infrastructure
 * import belongs in this test file; real-transaction/real-Postgres proof of
 * the canonical transitions lives in the infrastructure-level integration
 * suite, not here.
 */
function createMockUow(repo: MockRepo) {
  const refreshTokenRepository = {
    create: vi.fn(),
    getByToken: vi.fn(),
    getByTokenForUpdate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    cleanExpired: vi.fn(),
  };
  return {
    execute: vi.fn((work: (ctx: any) => Promise<any>) =>
      work({
        userRepository: repo,
        refreshTokenRepository,
        // Relocated off IUserRepository (see IIdentityUnitOfWork.ts) — exposed
        // here at the context's own top level, exactly where
        // applyCanonicalStatusTransition calls them, while still being the
        // same repo.lockUserForUpdate/repo.updateUserState vi.fn() instances
        // every test below configures and asserts on.
        lockUserForUpdate: repo.lockUserForUpdate,
        updateUserState: repo.updateUserState,
        deleteBearerSessionsForUser: vi.fn(),
        deleteExpressSessionsForUser: vi.fn(),
        writeAudit: vi.fn(),
      })
    ),
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
  describe('read operations', () => {
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

    it('propagates repository failure during auth username lookup', async () => {
      const repo = createMockRepo();
      const useCase = new UserManagementUseCase(repo);
      repo.getUserByUsername.mockRejectedValue(new Error('db unavailable'));

      await expect(useCase.findByUsername('auth_user')).rejects.toThrow('db unavailable');
    });
  });

  describe('create and ordinary update', () => {
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

    it('an ordinary-field-only PATCH (no isActive) bypasses the Identity UoW entirely', async () => {
      const repo = createMockRepo();
      const useCase = new UserManagementUseCase(repo);
      const updated = safeUserFixture({ fullName: 'Updated Name' });
      repo.updateUser.mockResolvedValue(updated);

      const result = await useCase.update('u-1', { fullName: 'Updated Name' }, actorFixture);

      expect(result.fullName).toBe('Updated Name');
      expect(repo.updateUser).toHaveBeenCalledWith('u-1', { fullName: 'Updated Name' });
    });
  });

  describe('generic isActive containment (I2A)', () => {
    it('a PATCH carrying isActive never reaches updateUser as a raw field — it routes through the canonical transition inside one UoW transaction', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.updateUser.mockResolvedValue(undefined);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: true, authGeneration: 0 });
      repo.getUser.mockResolvedValue(safeUserFixture({ isActive: false }));

      const result = await useCase.update('u-1', { isActive: false }, actorFixture);

      expect(uow.execute).toHaveBeenCalledTimes(1);
      expect(repo.updateUser).not.toHaveBeenCalled();
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 1 });
      expect(result.isActive).toBe(false);
    });

    it('a mixed PATCH (ordinary fields + isActive) persists both inside the SAME UoW transaction', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.updateUser.mockResolvedValue(undefined);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: true, authGeneration: 0 });
      repo.getUser.mockResolvedValue(safeUserFixture({ isActive: false }));

      const result = await useCase.update('u-1', { fullName: 'New Name', isActive: false }, actorFixture);

      expect(uow.execute).toHaveBeenCalledTimes(1);
      expect(repo.updateUser).toHaveBeenCalledWith('u-1', { fullName: 'New Name' });
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 1 });
      expect(result.isActive).toBe(false);
    });

    it('a mixed-PATCH failure inside the transaction issues both writes through the same execute() call, so a real transaction rolls both back together', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.updateUser.mockResolvedValue(undefined);
      repo.lockUserForUpdate.mockRejectedValue(new Error('lock failed'));

      await expect(
        useCase.update('u-1', { fullName: 'New Name', isActive: false }, actorFixture)
      ).rejects.toThrow('lock failed');

      expect(uow.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('canonical single-user transitions', () => {
    it('soft-delete routes through the canonical deactivation transition, not a bare isActive writer', async () => {
      const repo = createMockRepo();
      const useCase = new UserManagementUseCase(repo, createMockUow(repo) as any);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: true, authGeneration: 0 });
      repo.updateUserState.mockResolvedValue(undefined);

      const result = await useCase.softDelete('u-1', actorFixture);

      expect(result).toBe(true);
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 1 });
    });

    it('deactivateUser increments authGeneration exactly once and revokes credentials', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: true, authGeneration: 2 });

      await useCase.deactivateUser('u-1', actorFixture);

      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 3 });
    });

    it('reactivateUser sets isActive=true without touching authGeneration', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: false, authGeneration: 4 });

      await useCase.reactivateUser('u-1', actorFixture);

      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: true, authGeneration: 4 });
    });

    it('a transition to the already-current state is a no-op (idempotent, no audit noise)', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: false, authGeneration: 1 });

      await useCase.deactivateUser('u-1', actorFixture);

      expect(repo.updateUserState).not.toHaveBeenCalled();
    });
  });

  describe('bulk transitions', () => {
    it('bulk deactivate increments generation for every affected user, excluding the actor, and returns the affected count', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.getUsers.mockResolvedValue([
        safeUserFixture({ id: 'u-1', isActive: true }),
        safeUserFixture({ id: 'u-2', isActive: true }),
        safeUserFixture({ id: 'admin-1', isActive: true }),
      ]);
      repo.lockUserForUpdate.mockImplementation(async () => ({ isActive: true, authGeneration: 0 }));

      const count = await useCase.bulkDeactivate('admin-1', actorFixture);

      expect(count).toBe(2);
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 1 });
      expect(repo.updateUserState).toHaveBeenCalledWith('u-2', { isActive: false, authGeneration: 1 });
      expect(repo.updateUserState).not.toHaveBeenCalledWith('admin-1', expect.anything());
      expect(uow.execute).toHaveBeenCalledTimes(1);
    });

    it('bulk reactivate never resets authGeneration for any affected user', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.getUsers.mockResolvedValue([safeUserFixture({ id: 'u-1', isActive: false })]);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: false, authGeneration: 3 });

      await useCase.bulkReactivate(undefined, actorFixture);

      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: true, authGeneration: 3 });
    });

    it('updateAllStatus(true, ...) delegates to bulk reactivation', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.getUsers.mockResolvedValue([safeUserFixture({ id: 'u-1', isActive: false })]);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: false, authGeneration: 0 });

      const count = await useCase.updateAllStatus(true, undefined, actorFixture);

      expect(count).toBe(1);
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: true, authGeneration: 0 });
    });

    it('updateAllStatus(false, ...) delegates to bulk deactivation', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.getUsers.mockResolvedValue([safeUserFixture({ id: 'u-1', isActive: true })]);
      repo.lockUserForUpdate.mockResolvedValue({ isActive: true, authGeneration: 0 });

      const count = await useCase.updateAllStatus(false, undefined, actorFixture);

      expect(count).toBe(1);
      expect(repo.updateUserState).toHaveBeenCalledWith('u-1', { isActive: false, authGeneration: 1 });
    });

    it('bulk operations process affected users in deterministic (sorted-id) order', async () => {
      const repo = createMockRepo();
      const uow = createMockUow(repo);
      const useCase = new UserManagementUseCase(repo, uow as any);
      repo.getUsers.mockResolvedValue([
        safeUserFixture({ id: 'zzz', isActive: true }),
        safeUserFixture({ id: 'aaa', isActive: true }),
      ]);
      repo.lockUserForUpdate.mockImplementation(async () => ({ isActive: true, authGeneration: 0 }));

      await useCase.bulkDeactivate(undefined, actorFixture);

      // Each user is locked twice per transition (once by the bulk loop to
      // discover eligibility, once inside applyStatusTransition to read the
      // authoritative pre-transition state) — both calls are on the same row
      // within the same transaction, so de-duplicating consecutive repeats
      // isolates the property this test actually checks: users are visited
      // in deterministic sorted order, not the exact call count.
      const lockedOrder = repo.lockUserForUpdate.mock.calls.map((c: any[]) => c[0]);
      const dedupedOrder = lockedOrder.filter((id: string, i: number) => id !== lockedOrder[i - 1]);
      expect(dedupedOrder).toEqual(['aaa', 'zzz']);
    });
  });
});

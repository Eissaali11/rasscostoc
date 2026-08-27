import type { InsertUser, User, UserSafe } from "@shared/schema";
import type { IUserRepository, OrdinaryUserFieldUpdate } from '@stockpro/contracts';
import type { IIdentityUnitOfWork, IdentityTransactionalContext } from "../../../domain/repositories/IIdentityUnitOfWork";
import { NotFoundError } from "@core/errors/AppError";

/** Minimal identity of the actor performing a status transition, for audit. */
export type StatusTransitionActor = {
  id: string;
  username: string;
  role: string;
};

/**
 * The full legitimate intent of PATCH /api/users/:id: any ordinary field plus
 * an optional isActive transition request. Unlike OrdinaryUserFieldUpdate
 * (the persistence-layer payload), this application-level command MAY
 * represent isActive — the canonical transition is exactly what interprets
 * that field — but, like OrdinaryUserFieldUpdate, it can never represent
 * authGeneration (already absent from InsertUser at the schema level).
 */
export type UserUpdateCommand = OrdinaryUserFieldUpdate & { isActive?: boolean };

/**
 * Shared transition body used by every canonical entry point below. Must
 * only be called with the target user already locked (FOR UPDATE) in the
 * same transaction as ctx. Idempotent: a no-op transition (already in the
 * requested state) performs no writes and no audit entry. Exported as a
 * standalone function (not a UserManagementUseCase instance method) so
 * other transactional callers — e.g. a backup-restore use case running
 * inside its own already-open transaction — can reuse this exact algorithm
 * without duplicating it.
 */
export async function applyCanonicalStatusTransition(
  ctx: IdentityTransactionalContext,
  userId: string,
  isActive: boolean,
  actor: StatusTransitionActor
): Promise<void> {
  const current = await ctx.lockUserForUpdate(userId);
  if (!current) {
    throw new NotFoundError(`User with id ${userId} not found`);
  }
  if (current.isActive === isActive) {
    return; // already in the requested state — no-op, no audit noise
  }

  const nextGeneration = isActive ? current.authGeneration : current.authGeneration + 1;
  await ctx.updateUserState(userId, { isActive, authGeneration: nextGeneration });

  if (!isActive) {
    await ctx.refreshTokenRepository.revokeAllForUser(userId);
    await ctx.deleteBearerSessionsForUser(userId);
    await ctx.deleteExpressSessionsForUser(userId);
  }

  await ctx.writeAudit({
    userId: actor.id,
    userName: actor.username,
    userRole: actor.role,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "user",
    entityId: userId,
    entityName: userId,
    description: isActive
      ? `تم إعادة تفعيل حساب المستخدم (auth_generation=${nextGeneration})`
      : `تم تعطيل حساب المستخدم وإبطال جميع بيانات الاعتماد (auth_generation=${nextGeneration})`,
    severity: isActive ? "info" : "warn",
    success: true,
  });
}

export class UserManagementUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly identityUnitOfWork: IIdentityUnitOfWork
  ) {}

  async findAll(): Promise<UserSafe[]> {
    return this.userRepository.getUsers();
  }

  async findById(id: string): Promise<UserSafe | undefined> {
    return this.userRepository.getUser(id);
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.userRepository.getUserByUsername(username);
  }

  async findByRegion(regionId: string): Promise<UserSafe[]> {
    return this.userRepository.getUsersByRegion(regionId);
  }

  async findByRole(role: string): Promise<UserSafe[]> {
    return this.userRepository.getUsersByRole(role);
  }

  async create(input: InsertUser): Promise<UserSafe> {
    return this.userRepository.createUser(input);
  }

  /**
   * Ordinary field update, deliberately unaware of isActive. Callers that
   * receive a PATCH body must route isActive through update() below, which
   * separates it from this generic persistence and enforces the canonical
   * transition contract atomically when both are present.
   */
  async updateOrdinaryFields(id: string, updates: OrdinaryUserFieldUpdate): Promise<UserSafe> {
    return this.userRepository.updateUser(id, updates);
  }

  /**
   * Single entry point for PATCH /api/users/:id. If the body carries isActive,
   * the ordinary-field update and the canonical status transition run inside
   * ONE Identity Unit of Work transaction — either both persist or neither
   * does. isActive never reaches the generic persistence path directly.
   */
  async update(id: string, command: UserUpdateCommand, actor: StatusTransitionActor): Promise<UserSafe> {
    const { isActive, ...ordinaryUpdates } = command;

    if (isActive === undefined) {
      return this.userRepository.updateUser(id, ordinaryUpdates);
    }

    return this.identityUnitOfWork.execute(async (ctx) => {
      if (Object.keys(ordinaryUpdates).length > 0) {
        await ctx.userRepository.updateUser(id, ordinaryUpdates);
      }
      await applyCanonicalStatusTransition(ctx, id, isActive, actor);
      const updated = await ctx.userRepository.getUser(id);
      if (!updated) {
        throw new NotFoundError(`User with id ${id} not found`);
      }
      return updated;
    });
  }

  /** DELETE /api/users/:id — soft-delete routes through canonical deactivation. */
  async softDelete(id: string, actor: StatusTransitionActor): Promise<boolean> {
    return this.identityUnitOfWork.execute(async (ctx) => {
      const locked = await ctx.lockUserForUpdate(id);
      if (!locked) return false;
      await applyCanonicalStatusTransition(ctx, id, false, actor);
      return true;
    });
  }

  /** Canonical single-user deactivation: isActive=false, generation++, full credential invalidation, audit. */
  async deactivateUser(id: string, actor: StatusTransitionActor): Promise<void> {
    return this.identityUnitOfWork.execute(async (ctx) => {
      const locked = await ctx.lockUserForUpdate(id);
      if (!locked) {
        throw new NotFoundError(`User with id ${id} not found`);
      }
      await applyCanonicalStatusTransition(ctx, id, false, actor);
    });
  }

  /** Canonical single-user reactivation: isActive=true only, generation unchanged, fresh login required. */
  async reactivateUser(id: string, actor: StatusTransitionActor): Promise<void> {
    return this.identityUnitOfWork.execute(async (ctx) => {
      const locked = await ctx.lockUserForUpdate(id);
      if (!locked) {
        throw new NotFoundError(`User with id ${id} not found`);
      }
      await applyCanonicalStatusTransition(ctx, id, true, actor);
    });
  }

  /**
   * Bulk deactivation. Runs as ONE Identity UoW transaction across the whole
   * affected set — any failure rolls back every affected user, preserving the
   * atomicity level the existing single-statement bulk UPDATE already had.
   */
  async bulkDeactivate(excludeUserId: string | undefined, actor: StatusTransitionActor): Promise<number> {
    return this.identityUnitOfWork.execute(async (ctx) => {
      const all = await ctx.userRepository.getUsers();
      const targets = all
        .filter((u) => u.isActive && u.id !== excludeUserId)
        .map((u) => u.id)
        .sort();

      for (const id of targets) {
        const locked = await ctx.lockUserForUpdate(id);
        if (!locked) continue;
        await applyCanonicalStatusTransition(ctx, id, false, actor);
      }
      return targets.length;
    });
  }

  /** Bulk reactivation: isActive=true only, generation never reset, same atomic contract. */
  async bulkReactivate(excludeUserId: string | undefined, actor: StatusTransitionActor): Promise<number> {
    return this.identityUnitOfWork.execute(async (ctx) => {
      const all = await ctx.userRepository.getUsers();
      const targets = all
        .filter((u) => !u.isActive && u.id !== excludeUserId)
        .map((u) => u.id)
        .sort();

      for (const id of targets) {
        const locked = await ctx.lockUserForUpdate(id);
        if (!locked) continue;
        await applyCanonicalStatusTransition(ctx, id, true, actor);
      }
      return targets.length;
    });
  }

  /**
   * Preserves the existing bulk-status API surface (single boolean toggle for
   * everyone except one excluded user) by delegating to the deactivate/
   * reactivate paths above.
   */
  async updateAllStatus(isActive: boolean, excludeUserId: string | undefined, actor: StatusTransitionActor): Promise<number> {
    return isActive
      ? this.bulkReactivate(excludeUserId, actor)
      : this.bulkDeactivate(excludeUserId, actor);
  }
}

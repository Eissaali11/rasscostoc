import type { InsertUser, User, UserSafe } from "@shared/schema";
import type { IUserRepository, OrdinaryUserFieldUpdate } from '@stockpro/contracts';
import type { IIdentityUnitOfWork, IdentityTransactionalContext } from "../../../domain/repositories/IIdentityUnitOfWork";
import { NotFoundError } from "@core/errors/AppError";
import { assertLastActiveAdminSurvives } from "@core/authorization/last-active-admin.guard";

/** Minimal identity of the actor performing a status transition, for audit. */
export type StatusTransitionActor = {
  id: string;
  username: string;
  role: string;
};

/**
 * The full legitimate intent of PATCH /api/users/:id: any ordinary field plus
 * an optional isActive transition request and/or an optional role change.
 * Unlike OrdinaryUserFieldUpdate (the persistence-layer payload), this
 * application-level command MAY represent isActive and role — the canonical
 * membership transition below is exactly what interprets both fields — but,
 * like OrdinaryUserFieldUpdate, it can never represent authGeneration
 * (already absent from InsertUser at the schema level).
 */
export type UserUpdateCommand = OrdinaryUserFieldUpdate & { isActive?: boolean; role?: string };

/** What a canonical membership transition is being asked to change. Either or both may be present. */
export type AdminMembershipChange = { isActive?: boolean; role?: string };

/**
 * OPS-PERM-S1-F4-R2 — the canonical admin-membership transition. Supersedes
 * the narrower applyCanonicalStatusTransition (kept below as a thin
 * compatibility wrapper): the same last-active-admin invariant applies
 * whether a user is being deactivated OR demoted away from `admin`, so both
 * must converge on one function, one lock, one audit write.
 *
 * Must only be called with the target user already locked (FOR UPDATE) in
 * the same transaction as ctx — lockUserForUpdate below performs that lock
 * and returns role in the same read, so the role this function reasons about
 * is exactly the row this transaction holds, never a second, separately-timed
 * read. Idempotent: a change that resolves to no actual difference from the
 * current row performs no writes and no audit entry. Exported as a
 * standalone function (not a UserManagementUseCase instance method) so other
 * transactional callers — e.g. a backup-restore use case running inside its
 * own already-open transaction — can reuse this exact algorithm without
 * duplicating it.
 */
export async function applyCanonicalMembershipTransition(
  ctx: IdentityTransactionalContext,
  userId: string,
  changes: AdminMembershipChange,
  actor: StatusTransitionActor
): Promise<void> {
  const current = await ctx.lockUserForUpdate(userId);
  if (!current) {
    throw new NotFoundError(`User with id ${userId} not found`);
  }

  const diff = computeMembershipDiff(current, changes);
  if (!diff.activeChanging && !diff.roleChanging) {
    return; // already in the requested state / nothing actually changes — no-op, no audit noise
  }

  // OPS-PERM-S1-F4 §0/§7, hardened by R2 — last active admin protection. Relevant whenever this
  // transition would take a currently-active admin row to no-longer-an-active-admin, whether that
  // is isActive:true→false, role:admin→non-admin, or both in the same PATCH. Every other
  // transition (promotions, non-admin targets, reactivations) is unaffected and never touches the
  // advisory lock at all.
  if (diff.wasActiveAdmin && !diff.willBeActiveAdmin) {
    // R2 — acquire the shared advisory lock BEFORE reading the roster, so this read is
    // serialized against every other concurrent transaction that could also remove an active
    // admin (see acquireAdminMembershipLock's own doc comment for why this specific ordering is
    // what makes the count below safe under concurrency, not merely likely-safe).
    await ctx.acquireAdminMembershipLock();
    const otherActiveAdminCount = (await ctx.userRepository.getUsersByRole("admin")).filter(
      (u) => u.id !== userId && u.isActive
    ).length;
    assertLastActiveAdminSurvives({
      targetIsCurrentlyActiveAdmin: true,
      otherActiveAdminCount,
      targetWillBeActiveAdminAfter: false,
    });
  }

  await applyMembershipMutation(ctx, userId, { ...diff, currentAuthGeneration: current.authGeneration }, actor);
}

/** The diff between a row's current membership-relevant state and a requested change — pure, no I/O. */
export interface MembershipDiff {
  activeChanging: boolean;
  roleChanging: boolean;
  nextIsActive: boolean;
  nextRole: string;
  /** Was the row a currently-active admin BEFORE this change? */
  wasActiveAdmin: boolean;
  /** Will the row be an active admin AFTER this change? */
  willBeActiveAdmin: boolean;
}

/**
 * OPS-PERM-S1-F4-R3 — pure diff computation, extracted out of
 * applyCanonicalMembershipTransition so a multi-row caller (a backup restore
 * validating its whole batch's combined effect up front — see
 * wouldBatchLeaveZeroActiveAdmins) can compute exactly the same
 * wasActiveAdmin/willBeActiveAdmin classification this module's own
 * single-row canonical path uses, rather than reimplementing it.
 */
export function computeMembershipDiff(
  current: { isActive: boolean; role: string },
  changes: AdminMembershipChange
): MembershipDiff {
  const activeChanging = changes.isActive !== undefined && changes.isActive !== current.isActive;
  const roleChanging = changes.role !== undefined && changes.role !== current.role;
  const nextIsActive = activeChanging ? changes.isActive! : current.isActive;
  const nextRole = roleChanging ? changes.role! : current.role;
  return {
    activeChanging,
    roleChanging,
    nextIsActive,
    nextRole,
    wasActiveAdmin: current.role === "admin" && current.isActive,
    willBeActiveAdmin: nextRole === "admin" && nextIsActive,
  };
}

/**
 * OPS-PERM-S1-F4-R3 — applies an ALREADY-VALIDATED membership diff (writes +
 * audit only). Deliberately does NOT perform the last-active-admin check
 * itself — the caller must have already proven this transition (or, for a
 * multi-row caller, the whole batch it belongs to) safe:
 * applyCanonicalMembershipTransition does so per-row before calling this;
 * ImportSystemBackupUseCase does so for its entire restore batch at once
 * (via wouldBatchLeaveZeroActiveAdmins) before calling this once per changed
 * row — because a second per-row live-state re-check at write time could
 * reject a batch its own up-front validation had already proven safe, purely
 * because of row-processing order (see wouldBatchLeaveZeroActiveAdmins's own
 * doc comment). Exported so every caller applies a validated transition
 * through this exact one write path — same primitives, same audit wording —
 * never a second, divergent one.
 */
export async function applyMembershipMutation(
  ctx: IdentityTransactionalContext,
  userId: string,
  plan: MembershipDiff & { currentAuthGeneration: number },
  actor: StatusTransitionActor
): Promise<void> {
  const { activeChanging, roleChanging, nextIsActive, nextRole, currentAuthGeneration } = plan;

  if (roleChanging) {
    await ctx.updateUserRole(userId, nextRole);
  }

  let nextGeneration = currentAuthGeneration;
  if (activeChanging) {
    nextGeneration = nextIsActive ? currentAuthGeneration : currentAuthGeneration + 1;
    await ctx.updateUserState(userId, { isActive: nextIsActive, authGeneration: nextGeneration });

    if (!nextIsActive) {
      await ctx.refreshTokenRepository.revokeAllForUser(userId);
      await ctx.deleteBearerSessionsForUser(userId);
      await ctx.deleteExpressSessionsForUser(userId);
    }
  }

  const { action, description, severity } = describeMembershipAudit({
    activeChanging,
    roleChanging,
    nextIsActive,
    nextRole,
    nextGeneration,
  });

  await ctx.writeAudit({
    userId: actor.id,
    userName: actor.username,
    userRole: actor.role,
    action,
    entityType: "user",
    entityId: userId,
    entityName: userId,
    description,
    severity,
    success: true,
  });
}

function describeMembershipAudit(t: {
  activeChanging: boolean;
  roleChanging: boolean;
  nextIsActive: boolean;
  nextRole: string;
  nextGeneration: number;
}): { action: string; description: string; severity: "info" | "warn" | "error" } {
  if (t.activeChanging && !t.roleChanging) {
    // Exact wording preserved from the pre-R2 single-purpose function — existing audit
    // consumers/tests key off this text for the plain isActive transition.
    return {
      action: t.nextIsActive ? "reactivate" : "deactivate",
      description: t.nextIsActive
        ? `تم إعادة تفعيل حساب المستخدم (auth_generation=${t.nextGeneration})`
        : `تم تعطيل حساب المستخدم وإبطال جميع بيانات الاعتماد (auth_generation=${t.nextGeneration})`,
      severity: t.nextIsActive ? "info" : "warn",
    };
  }
  if (t.roleChanging && !t.activeChanging) {
    return {
      action: "role-change",
      description: `تم تغيير دور المستخدم إلى ${t.nextRole}`,
      severity: "warn",
    };
  }
  // Both changed in the same PATCH.
  return {
    action: t.nextIsActive ? "role-change-reactivate" : "role-change-deactivate",
    description: t.nextIsActive
      ? `تم تغيير دور المستخدم إلى ${t.nextRole} وإعادة تفعيل الحساب (auth_generation=${t.nextGeneration})`
      : `تم تغيير دور المستخدم إلى ${t.nextRole} وتعطيل الحساب وإبطال جميع بيانات الاعتماد (auth_generation=${t.nextGeneration})`,
    severity: "warn",
  };
}

/**
 * Compatibility wrapper over applyCanonicalMembershipTransition, preserved
 * for every pre-R2 call site (softDelete/deactivateUser/reactivateUser/
 * bulkDeactivate/bulkReactivate below, and any other already-open-transaction
 * caller) that only ever needs an isActive transition with no role change.
 */
export async function applyCanonicalStatusTransition(
  ctx: IdentityTransactionalContext,
  userId: string,
  isActive: boolean,
  actor: StatusTransitionActor
): Promise<void> {
  return applyCanonicalMembershipTransition(ctx, userId, { isActive }, actor);
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
   * Single entry point for PATCH /api/users/:id. If the body carries isActive
   * and/or role, the ordinary-field update and the canonical membership
   * transition run inside ONE Identity Unit of Work transaction — either all
   * of it persists or none of it does. Neither isActive nor role ever reaches
   * the generic persistence path directly (OPS-PERM-S1-F4-R2: role changes
   * are exactly as capable of removing the last active Admin as an isActive
   * transition is, so both must go through the same guarded transaction).
   */
  async update(id: string, command: UserUpdateCommand, actor: StatusTransitionActor): Promise<UserSafe> {
    const { isActive, role, ...ordinaryUpdates } = command;

    if (isActive === undefined && role === undefined) {
      return this.userRepository.updateUser(id, ordinaryUpdates);
    }

    return this.identityUnitOfWork.execute(async (ctx) => {
      if (Object.keys(ordinaryUpdates).length > 0) {
        await ctx.userRepository.updateUser(id, ordinaryUpdates);
      }
      await applyCanonicalMembershipTransition(ctx, id, { isActive, role }, actor);
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

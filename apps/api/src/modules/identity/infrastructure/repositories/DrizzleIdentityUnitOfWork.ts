import { sql, eq } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import { bearerSessions, systemLogs } from "@shared/schema";
import type {
  IIdentityUnitOfWork,
  IdentityTransactionalContext,
  IdentityAuditEntry,
} from "../../domain/repositories/IIdentityUnitOfWork";
import { DrizzleUserRepository, type IdentityDbTransaction } from "../database/DrizzleUserRepository";
import { DrizzleRefreshTokenRepository } from "../database/DrizzleRefreshTokenRepository";
import { ADMIN_MEMBERSHIP_ADVISORY_LOCK_KEY } from "@core/authorization/last-active-admin.guard";
import { UserManagementUseCase } from "../../application/users/use-cases/UserManagement.use-case";

/**
 * Builds an IdentityTransactionalContext bound to an already-open
 * transaction handle. Never opens its own transaction — the caller (either
 * DrizzleIdentityUnitOfWork.execute() below, or another already-open
 * transaction, e.g. ImportSystemBackupUseCase's restore transaction) owns
 * that. Takes Drizzle's own real transaction type — no cast is required or
 * permitted at any call site.
 */
export function buildIdentityTransactionalContext(tx: IdentityDbTransaction): IdentityTransactionalContext {
  const userRepository = new DrizzleUserRepository(tx);
  const refreshTokenRepository = new DrizzleRefreshTokenRepository(tx);

  return {
    userRepository,
    refreshTokenRepository,

    async lockUserForUpdate(id) {
      return userRepository.lockUserForUpdate(id);
    },

    async updateUserState(id, state) {
      return userRepository.updateUserState(id, state);
    },

    async updateUserRole(id, role) {
      return userRepository.updateUserRole(id, role);
    },

    async acquireAdminMembershipLock(): Promise<void> {
      // Transaction-scoped — auto-released on commit or rollback. See the
      // interface doc comment (IIdentityUnitOfWork.ts) and
      // ADMIN_MEMBERSHIP_ADVISORY_LOCK_KEY's own doc comment for why this is
      // the mechanism that makes the last-active-admin check concurrency-safe.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_MEMBERSHIP_ADVISORY_LOCK_KEY})`);
    },

    async deleteBearerSessionsForUser(userId: string): Promise<void> {
      await tx.delete(bearerSessions).where(eq(bearerSessions.userId, userId));
    },

    async deleteExpressSessionsForUser(userId: string): Promise<void> {
      // connect-pg-simple's default table has no dedicated user_id column —
      // the user is nested inside the stored JSON (`sess.user.id`), proven
      // by direct execution against a real session-write path (see I2A.D0.R2
      // forensic evidence). sess is stored as `json`, hence the explicit cast.
      await tx.execute(
        sql`DELETE FROM "session" WHERE (sess::jsonb) -> 'user' ->> 'id' = ${userId}`
      );
    },

    async writeAudit(entry: IdentityAuditEntry): Promise<void> {
      await tx.insert(systemLogs).values({
        userId: entry.userId,
        userName: entry.userName,
        userRole: entry.userRole,
        regionId: null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityName: entry.entityName,
        description: entry.description,
        severity: entry.severity,
        success: entry.success,
      });
    },
  };
}

export class DrizzleIdentityUnitOfWork implements IIdentityUnitOfWork {
  async execute<T>(work: (context: IdentityTransactionalContext) => Promise<T>): Promise<T> {
    const database = getDatabase();
    return database.transaction(async (tx) => work(buildIdentityTransactionalContext(tx)));
  }
}

/**
 * OPS-PERM-S1-F4-R3 — a fully-wired UserManagementUseCase, for another
 * module's real-Postgres concurrency proof that needs to drive a genuine
 * PATCH-path mutation (deactivateUser/update) concurrently with its own
 * operation (see ImportSystemBackup.admin-invariant.test.ts §8-10).
 * Lives here — infrastructure/repositories/, this module's own internal
 * composition — and is re-exported only through identity.api.ts (the sole
 * cross-module surface), never as a raw concrete repository/use-case export:
 * this file (not the presentation/http/*.api.ts re-export) is the one place
 * within the identity module allowed to reach into infrastructure/database/
 * (.dependency-cruiser.cjs's controller-should-not-depend-on-repository-or-drizzle
 * restricts presentation/ specifically, not infrastructure/).
 */
export function createUserManagementUseCase(): UserManagementUseCase {
  return new UserManagementUseCase(new DrizzleUserRepository(), new DrizzleIdentityUnitOfWork());
}

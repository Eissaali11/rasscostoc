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

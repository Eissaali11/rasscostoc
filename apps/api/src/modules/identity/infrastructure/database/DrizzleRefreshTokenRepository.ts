import { eq, and } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import { refreshTokens, type RefreshToken } from "@shared/schema";
import type { IRefreshTokenRepository } from "@stockpro/contracts";
import type { IdentityDbClient } from "./DrizzleUserRepository";

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * Pass a transaction handle (the `tx` from db.transaction(async (tx) => ...))
   * to bind this repository instance to that transaction — required whenever
   * its writes must be atomic with writes made through another repository
   * (see DrizzleIdentityUnitOfWork). Omit to use the global connection.
   */
  constructor(private readonly dbClient: IdentityDbClient = getDatabase()) {}

  private get db(): IdentityDbClient {
    return this.dbClient;
  }

  /**
   * Create a new refresh token record. authGeneration is the issuing
   * authentication event's snapshot of the user's current auth generation —
   * it must never be re-read from the database at call time, so that a row
   * created after a deactivation's revocation sweep still carries the stale
   * pre-deactivation generation and fails the next refresh's comparison.
   */
  async create(token: string, userId: string, expiry: Date, authGeneration: number): Promise<RefreshToken> {
    const [record] = await this.db
      .insert(refreshTokens)
      .values({
        token,
        userId,
        expiry,
        isRevoked: false,
        authGeneration,
      })
      .returning();
    return record;
  }

  /**
   * Get refresh token record with details
   */
  async getByToken(token: string): Promise<RefreshToken | undefined> {
    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token));
    return record || undefined;
  }

  /**
   * Locks the refresh-token row so a concurrent refresh of the same token
   * cannot also pass validation before this transaction commits. Must be
   * called from within a transaction.
   */
  async getByTokenForUpdate(token: string): Promise<RefreshToken | undefined> {
    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .for("update");
    return record || undefined;
  }

  /**
   * Revoke a refresh token and link it to the token that replaced it (for rotation)
   */
  async revoke(token: string, replacedBy?: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        replacedBy: replacedBy || null,
      })
      .where(eq(refreshTokens.token, token));
  }

  /**
   * Revoke all refresh tokens for a user (used as a security measure upon token reuse detection)
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
      })
      .where(eq(refreshTokens.userId, userId));
  }

  /**
   * Clean up expired or revoked tokens
   */
  async cleanExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(refreshTokens)
      .where(
        and(
          eq(refreshTokens.isRevoked, true)
        )
      );
    return result.rowCount || 0;
  }
}

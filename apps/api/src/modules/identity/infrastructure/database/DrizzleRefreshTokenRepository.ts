import { eq, and } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import { refreshTokens, type RefreshToken } from "@shared/schema";
import type { IRefreshTokenRepository } from "@stockpro/contracts";

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
  private get db() {
    return getDatabase();
  }

  /**
   * Create a new refresh token record
   */
  async create(token: string, userId: string, expiry: Date): Promise<RefreshToken> {
    const [record] = await this.db
      .insert(refreshTokens)
      .values({
        token,
        userId,
        expiry,
        isRevoked: false,
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

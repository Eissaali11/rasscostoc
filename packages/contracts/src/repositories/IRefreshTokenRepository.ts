import type { RefreshToken } from "@shared/schema";

export interface IRefreshTokenRepository {
  /**
   * authGeneration is the issuing authentication event's snapshot of
   * users.authGeneration (immutable for the lifetime of this row) — never the
   * value re-read at persistence time.
   */
  create(token: string, userId: string, expiry: Date, authGeneration: number): Promise<RefreshToken>;
  getByToken(token: string): Promise<RefreshToken | undefined>;

  /**
   * Locks the refresh-token row (SELECT ... FOR UPDATE) so a concurrent
   * refresh of the same token cannot both pass validation. Must be called
   * from within a transaction.
   */
  getByTokenForUpdate(token: string): Promise<RefreshToken | undefined>;

  revoke(token: string, replacedBy?: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  cleanExpired(): Promise<number>;
}

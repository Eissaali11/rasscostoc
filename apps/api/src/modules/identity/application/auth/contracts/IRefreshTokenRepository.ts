import type { RefreshToken } from "@shared/schema";

export interface IRefreshTokenRepository {
  create(token: string, userId: string, expiry: Date): Promise<RefreshToken>;
  getByToken(token: string): Promise<RefreshToken | undefined>;
  revoke(token: string, replacedBy?: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  cleanExpired(): Promise<number>;
}

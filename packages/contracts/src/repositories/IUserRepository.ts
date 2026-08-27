import type { InsertUser, User, UserSafe } from "@shared/schema";

/** Persistence-level user state used by the canonical activation/deactivation transitions. */
export interface UserAuthState {
  isActive: boolean;
  authGeneration: number;
}

/**
 * Ordinary field persistence payload. Deliberately excludes `isActive` (and,
 * since `authGeneration` is already absent from `InsertUser` at the schema
 * level, `authGeneration` transitively too) — no ordinary field update may
 * represent either the security-sensitive fields, so a caller can never write
 * them through this path even if application-layer discipline lapses.
 */
export type OrdinaryUserFieldUpdate = Partial<Omit<InsertUser, "isActive">>;

export interface IUserRepository {
  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<UserSafe[]>;
  getUsersByRegion(regionId: string): Promise<UserSafe[]>;
  createUser(insertUser: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: OrdinaryUserFieldUpdate): Promise<UserSafe>;
}

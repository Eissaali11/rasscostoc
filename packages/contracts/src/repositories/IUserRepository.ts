import type { InsertUser, User, UserSafe } from "@shared/schema";

/** Persistence-level user state used by the canonical activation/deactivation transitions. */
export interface UserAuthState {
  isActive: boolean;
  authGeneration: number;
}

/**
 * OPS-PERM-S1-F4-R2 — `UserAuthState` plus the row's current `role`, read
 * atomically under the same `SELECT ... FOR UPDATE` (see
 * DrizzleUserRepository.lockUserForUpdate). The last-active-admin guard needs
 * the row's role at the exact moment it holds the lock — a second, separate
 * read would not be covered by that lock the way this one is.
 */
export interface UserSecurityState extends UserAuthState {
  role: string;
}

/**
 * Ordinary field persistence payload. Deliberately excludes `isActive` (and,
 * since `authGeneration` is already absent from `InsertUser` at the schema
 * level, `authGeneration` transitively too) — no ordinary field update may
 * represent either the security-sensitive fields, so a caller can never write
 * them through this path even if application-layer discipline lapses.
 *
 * OPS-PERM-S1-F4-R2: `role` is excluded for the same reason. A role change is
 * capable of removing the system's last active Admin exactly like an
 * isActive:true→false transition is — it must always be evaluated by the
 * canonical admin-membership transition (see UserManagement.use-case.ts),
 * never persisted as a bare ordinary-profile field.
 */
export type OrdinaryUserFieldUpdate = Partial<Omit<InsertUser, "isActive" | "role">>;

export interface IUserRepository {
  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<UserSafe[]>;
  getUsersByRegion(regionId: string): Promise<UserSafe[]>;
  createUser(insertUser: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: OrdinaryUserFieldUpdate): Promise<UserSafe>;
}

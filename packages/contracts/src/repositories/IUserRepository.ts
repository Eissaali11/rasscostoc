import type { InsertUser, User, UserSafe } from "@shared/schema";

export interface IUserRepository {
  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<UserSafe[]>;
  getUsersByRegion(regionId: string): Promise<UserSafe[]>;
  getUsersByIds(ids: readonly string[]): Promise<UserSafe[]>;
  searchUserIdsByName(term: string): Promise<readonly string[]>;
  getUserByUsernameOrFullNameCI(term: string): Promise<UserSafe | undefined>;
  getAllUsersForBackup(): Promise<User[]>;
  userExistsWithRole(id: string, roles: readonly string[]): Promise<boolean>;
  userExistsInRegion(regionId: string): Promise<boolean>;
  getUserRegionId(id: string): Promise<string | null>;
  getUserCountsByRole(): Promise<Record<string, number>>;
  getActiveUserStats(): Promise<{ total: number; active: number }>;
  getUserCountsByRegion(): Promise<ReadonlyArray<{ regionId: string | null; count: number }>>;
  getUserCountsByRegionAndRole(): Promise<ReadonlyArray<{ regionId: string | null; role: string; count: number }>>;
  getDistinctUserCityCount(): Promise<number>;
  createUser(insertUser: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe>;
  deleteUser(id: string): Promise<boolean>;
  updateAllUsersStatus(isActive: boolean, excludeUserId?: string): Promise<number>;
  restoreUserFromBackup(
    payload: {
      sourceId: string;
      username: string;
      email?: string | null;
      password: string;
      fullName?: string | null;
      profileImage?: string | null;
      city?: string | null;
      role: "admin" | "supervisor" | "technician";
      regionId?: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    tx?: unknown
  ): Promise<{ id: string }>;
}

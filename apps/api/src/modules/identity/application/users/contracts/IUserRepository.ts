import type { InsertUser, User, UserSafe } from "@shared/schema";

export interface IUserRepository {
  getUsers(): Promise<UserSafe[]>;
  getUser(id: string): Promise<UserSafe | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<UserSafe[]>;
  getUsersByRegion(regionId: string): Promise<UserSafe[]>;
  createUser(insertUser: InsertUser): Promise<UserSafe>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe>;
  deleteUser(id: string): Promise<boolean>;
  updateAllUsersStatus(isActive: boolean, excludeUserId?: string): Promise<number>;
}

import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import type { InsertUser, UserSafe } from "@shared/schema";

const userRepo = new UserRepository();

export async function getUsers(): Promise<UserSafe[]> {
  return userRepo.getUsers();
}

export async function getUser(id: string): Promise<UserSafe | undefined> {
  return userRepo.getUser(id);
}

export async function getUserByUsername(username: string) {
  return userRepo.getUserByUsername(username);
}

export async function createUser(user: InsertUser): Promise<UserSafe> {
  return userRepo.createUser(user);
}

export async function updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe> {
  return userRepo.updateUser(id, updates);
}

export async function deleteUser(id: string): Promise<boolean> {
  return userRepo.deleteUser(id);
}

export async function getUsersByRole(role: string) {
  return userRepo.getUsersByRole(role);
}

export async function getUsersByRegion(regionId: string) {
  return userRepo.getUsersByRegion(regionId);
}

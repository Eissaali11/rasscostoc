import type { InsertUser, User, UserSafe } from "@shared/schema";
import type { IUserRepository } from '@stockpro/contracts';

export class UserManagementUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async findAll(): Promise<UserSafe[]> {
    return this.userRepository.getUsers();
  }

  async findById(id: string): Promise<UserSafe | undefined> {
    return this.userRepository.getUser(id);
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.userRepository.getUserByUsername(username);
  }

  async findByRegion(regionId: string): Promise<UserSafe[]> {
    return this.userRepository.getUsersByRegion(regionId);
  }

  async findByRole(role: string): Promise<UserSafe[]> {
    return this.userRepository.getUsersByRole(role);
  }

  async create(input: InsertUser): Promise<UserSafe> {
    return this.userRepository.createUser(input);
  }

  async update(id: string, updates: Partial<InsertUser>): Promise<UserSafe> {
    return this.userRepository.updateUser(id, updates);
  }

  async softDelete(id: string): Promise<boolean> {
    return this.userRepository.deleteUser(id);
  }

  async updateAllStatus(isActive: boolean, excludeUserId?: string): Promise<number> {
    return this.userRepository.updateAllUsersStatus(isActive, excludeUserId);
  }
}

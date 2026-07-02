import { eq, ne } from 'drizzle-orm';
import type { IUserRepository } from '../../application/users/contracts/IUserRepository';
import { getDatabase } from "@core/database/connection";
import { type InsertUser, type User, type UserSafe, users } from "@shared/schema";

export class DrizzleUserRepository implements IUserRepository {
  private get db() {
    return getDatabase();
  }

  async getUsers(): Promise<UserSafe[]> {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users);
  }

  async getUser(id: string): Promise<UserSafe | undefined> {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id));

    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));

    return user || undefined;
  }

  async getUsersByRole(role: string): Promise<UserSafe[]> {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.role, role as any));
  }

  async getUsersByRegion(regionId: string): Promise<UserSafe[]> {
    return this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.regionId, regionId));
  }

  async createUser(insertUser: InsertUser): Promise<UserSafe> {
    const existingUserByUsername = await this.getUserByUsername(insertUser.username);
    if (existingUserByUsername) {
      throw new Error('Username already exists');
    }

    const [existingUserByEmail] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, insertUser.email));
    if (existingUserByEmail) {
      throw new Error('Email already exists');
    }

    const [user] = await this.db
      .insert(users)
      .values({
        ...insertUser,
        role: insertUser.role || 'technician',
        isActive: insertUser.isActive ?? true,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe> {
    const existingUser = await this.getUser(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    if (updates.username && updates.username !== existingUser.username) {
      const existingUserByUsername = await this.getUserByUsername(updates.username);
      if (existingUserByUsername) {
        throw new Error('Username already exists');
      }
    }

    if (updates.email && updates.email !== existingUser.email) {
      const [existingUserByEmail] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, updates.email));
      if (existingUserByEmail) {
        throw new Error('Email already exists');
      }
    }

    const [user] = await this.db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return (result.rowCount || 0) > 0;
  }

  async updateAllUsersStatus(isActive: boolean, excludeUserId?: string): Promise<number> {
    const updateObj = { isActive, updatedAt: new Date() };
    let result;
    if (excludeUserId) {
      result = await this.db
        .update(users)
        .set(updateObj)
        .where(ne(users.id, excludeUserId));
    } else {
      result = await this.db
        .update(users)
        .set(updateObj);
    }
    return result.rowCount || 0;
  }
}

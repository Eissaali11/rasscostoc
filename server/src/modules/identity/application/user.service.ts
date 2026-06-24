import { db } from "@core/config/db";
import { 
  users, 
  regions,
  supervisorTechnicians,
  supervisorWarehouses,
  type User,
  type UserSafe,
  type InsertUser,
  type Region,
  type SupervisorTechnician,
  type SupervisorWarehouse,
  type InsertSupervisorTechnician,
  type InsertSupervisorWarehouse
} from "@shared/schema";
import { eq, and, or, ilike, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * User Management Service
 * Handles all user-related operations including authentication and authorization
 */
export class UserService {

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: User): UserSafe {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Get all users (safe version without passwords)
   */
  async getUsers(): Promise<UserSafe[]> {
    const allUsers = await db
      .select()
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id));

    return allUsers.map(({ users: user }) => this.sanitizeUser(user));
  }

  /**
   * Get user by ID (safe version)
   */
  async getUser(id: string): Promise<UserSafe | undefined> {
    const result = await db
      .select()
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!result[0]) return undefined;

    const { users: user } = result[0];
    return this.sanitizeUser(user);
  }

  /**
   * Get user by username (includes password for authentication)
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user || undefined;
  }

  /**
   * Get user by email (includes password for authentication)
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || undefined;
  }

  /**
   * Create new user
   */
  async createUser(insertUser: InsertUser): Promise<UserSafe> {
    // Hash password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const [newUser] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword
      })
      .returning();

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    return this.sanitizeUser(newUser);
  }

  /**
   * Update user
   */
  async updateUser(id: string, updates: Partial<InsertUser>): Promise<UserSafe> {
    // Hash password if it's being updated
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));

    return (result as any).changes > 0;
  }

  /**
   * Authenticate user
   */
  async authenticateUser(username: string, password: string): Promise<UserSafe | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return this.sanitizeUser(user);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<UserSafe[]> {
    const roleUsers = await db
      .select()
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(eq(users.role, role));

    return roleUsers.map(({ users: user, regions: region }) => ({
      ...this.sanitizeUser(user),
      regionName: region?.name || "غير محدد"
    }));
  }

  /**
   * Get users by region
   */
  async getUsersByRegion(regionId: string): Promise<UserSafe[]> {
    const regionUsers = await db
      .select()
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(eq(users.regionId, regionId));

    return regionUsers.map(({ users: user, regions: region }) => ({
      ...this.sanitizeUser(user),
      regionName: region?.name || "غير محدد"
    }));
  }

  /**
   * Search users
   */
  async searchUsers(query: string, role?: string): Promise<UserSafe[]> {
    let whereConditions = or(
      ilike(users.fullName, `%${query}%`),
      ilike(users.username, `%${query}%`),
      ilike(users.email, `%${query}%`),
      ilike(users.city, `%${query}%`)
    );

    if (role) {
      whereConditions = and(whereConditions, eq(users.role, role));
    }

    const searchResults = await db
      .select()
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(whereConditions);

    return searchResults.map(({ users: user, regions: region }) => ({
      ...this.sanitizeUser(user),
      regionName: region?.name || "غير محدد"
    }));
  }

  /**
   * Get technicians for a supervisor
   */
  async getSupervisorTechnicians(supervisorId: string): Promise<string[]> {
    const assignments = await db
      .select({ technicianId: supervisorTechnicians.technicianId })
      .from(supervisorTechnicians)
      .where(eq(supervisorTechnicians.supervisorId, supervisorId));

    return assignments.map(a => a.technicianId);
  }

  /**
   * Assign technician to supervisor
   */
  async assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician> {
    const [assignment] = await db
      .insert(supervisorTechnicians)
      .values({ supervisorId, technicianId })
      .returning();

    if (!assignment) {
      throw new Error("Failed to assign technician to supervisor");
    }

    return assignment;
  }

  /**
   * Remove technician from supervisor
   */
  async removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean> {
    const result = await db
      .delete(supervisorTechnicians)
      .where(
        and(
          eq(supervisorTechnicians.supervisorId, supervisorId),
          eq(supervisorTechnicians.technicianId, technicianId)
        )
      );

    return (result as any).changes > 0;
  }

  /**
   * Get warehouses for a supervisor
   */
  async getSupervisorWarehouses(supervisorId: string): Promise<string[]> {
    const assignments = await db
      .select({ warehouseId: supervisorWarehouses.warehouseId })
      .from(supervisorWarehouses)
      .where(eq(supervisorWarehouses.supervisorId, supervisorId));

    return assignments.map(a => a.warehouseId);
  }

  /**
   * Assign warehouse to supervisor
   */
  async assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse> {
    const [assignment] = await db
      .insert(supervisorWarehouses)
      .values({ supervisorId, warehouseId })
      .returning();

    if (!assignment) {
      throw new Error("Failed to assign warehouse to supervisor");
    }

    return assignment;
  }

  /**
   * Remove warehouse from supervisor
   */
  async removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean> {
    const result = await db
      .delete(supervisorWarehouses)
      .where(
        and(
          eq(supervisorWarehouses.supervisorId, supervisorId),
          eq(supervisorWarehouses.warehouseId, warehouseId)
        )
      );

    return (result as any).changes > 0;
  }

  /**
   * Get supervisor for a technician
   */
  async getTechnicianSupervisor(technicianId: string): Promise<string | null> {
    const [assignment] = await db
      .select({ supervisorId: supervisorTechnicians.supervisorId })
      .from(supervisorTechnicians)
      .where(eq(supervisorTechnicians.technicianId, technicianId))
      .limit(1);

    return assignment?.supervisorId || null;
  }

  /**
   * Update user password
   */
  async updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));

    return (result as any).changes > 0;
  }

  /**
   * Activate or deactivate user
   */
  async setUserActiveStatus(id: string, isActive: boolean): Promise<UserSafe> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return this.sanitizeUser(updatedUser);
  }
}
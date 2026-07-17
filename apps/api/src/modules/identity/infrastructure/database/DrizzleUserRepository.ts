import { eq, ne, inArray, count, sql, or, ilike } from 'drizzle-orm';
import type { IUserRepository } from '@stockpro/contracts';
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.regionId, regionId));
  }

  async getUsersByIds(ids: readonly string[]): Promise<UserSafe[]> {
    if (ids.length === 0) return [];
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(inArray(users.id, ids as string[]));
  }

  async searchUserIdsByName(term: string): Promise<readonly string[]> {
    const pattern = `%${term}%`;
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(ilike(users.fullName, pattern), ilike(users.username, pattern)));
    return rows.map((r) => r.id);
  }

  async getUserByUsernameOrFullNameCI(term: string): Promise<UserSafe | undefined> {
    const trimmed = term.trim();
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = LOWER(${trimmed})`,
          sql`LOWER(${users.fullName}) = LOWER(${trimmed})`
        )
      )
      .limit(1);
    return user || undefined;
  }

  async userExistsWithRole(id: string, roles: readonly string[]): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        sql`${users.id} = ${id} AND ${users.role} IN (${sql.join(roles.map((r) => sql`${r}`), sql`, `)})`
      )
      .limit(1);
    return !!row;
  }

  async userExistsInRegion(regionId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.regionId, regionId))
      .limit(1);
    return !!row;
  }

  async getUserRegionId(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ regionId: users.regionId })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row?.regionId ?? null;
  }

  async getUserCountsByRole(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ role: users.role, count: count() })
      .from(users)
      .groupBy(users.role);
    return rows.reduce((acc: Record<string, number>, row) => {
      if (row.role) acc[row.role] = Number(row.count);
      return acc;
    }, {});
  }

  async getActiveUserStats(): Promise<{ total: number; active: number }> {
    const [row] = await this.db
      .select({
        total: count(),
        active: sql<number>`COUNT(CASE WHEN ${users.isActive} = true THEN 1 END)`,
      })
      .from(users);
    return { total: Number(row?.total ?? 0), active: Number(row?.active ?? 0) };
  }

  async getUserCountsByRegion(): Promise<ReadonlyArray<{ regionId: string | null; count: number }>> {
    const rows = await this.db
      .select({ regionId: users.regionId, count: count() })
      .from(users)
      .groupBy(users.regionId);
    return rows.map((r) => ({ regionId: r.regionId, count: Number(r.count) }));
  }

  async getDistinctUserCityCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(DISTINCT ${users.city})` })
      .from(users)
      .where(sql`${users.city} IS NOT NULL AND ${users.city} != ''`);
    return Number(row?.count ?? 0);
  }

  async getUserCountsByRegionAndRole(): Promise<ReadonlyArray<{ regionId: string | null; role: string; count: number }>> {
    const rows = await this.db
      .select({ regionId: users.regionId, role: users.role, count: count() })
      .from(users)
      .groupBy(users.regionId, users.role);
    return rows.map((r) => ({ regionId: r.regionId, role: r.role, count: Number(r.count) }));
  }

  /**
   * Full-fidelity dump for ExportSystemBackup.use-case.ts (ERP-005A-4 Phase 4).
   * Intentionally includes password (hashed) — a backup must round-trip
   * exactly through restoreUserFromBackup() below.
   */
  async getAllUsersForBackup(): Promise<User[]> {
    return this.db.select().from(users);
  }

  /**
   * Upsert-on-restore for system-backup imports (ERP-005A-4 Phase 4, Type D).
   * Replicates the exact id/username/email collision resolution previously
   * inlined in inventory's ImportSystemBackup.use-case.ts: resolve target id
   * by existing id or username; if the (possibly resolved) username is taken
   * by a *different* user, suffix it; same for email; then update or insert.
   * Accepts an optional external transaction executor so it can participate
   * in the caller's larger multi-table restore transaction.
   */
  async restoreUserFromBackup(
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
    tx?: any
  ): Promise<{ id: string }> {
    const executor = tx ?? this.db;

    const [existingById] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, payload.sourceId))
      .limit(1);

    const [existingByUsername] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, payload.username))
      .limit(1);

    const targetId = existingById?.id ?? existingByUsername?.id ?? payload.sourceId;
    let resolvedUsername = payload.username;

    const [usernameOwner] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, resolvedUsername))
      .limit(1);

    if (usernameOwner && usernameOwner.id !== targetId) {
      resolvedUsername = `${payload.username}_${targetId.slice(0, 8)}`;
    }

    let resolvedEmail =
      payload.email ?? `${resolvedUsername}.${targetId.slice(0, 8)}@import.local`;

    const [emailOwner] = await executor
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, resolvedEmail))
      .limit(1);

    if (emailOwner && emailOwner.id !== targetId) {
      resolvedEmail = `${resolvedUsername}.${targetId.slice(0, 8)}@import.local`;
    }

    const userPayload = {
      username: resolvedUsername,
      email: resolvedEmail,
      password: payload.password,
      fullName: payload.fullName ?? resolvedUsername,
      profileImage: payload.profileImage ?? null,
      city: payload.city ?? null,
      role: payload.role,
      regionId: payload.regionId ?? null,
      isActive: payload.isActive,
    };

    if (existingById || existingByUsername) {
      await executor
        .update(users)
        .set({ ...userPayload, updatedAt: new Date() })
        .where(eq(users.id, targetId));
    } else {
      await executor.insert(users).values({
        id: targetId,
        ...userPayload,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      });
    }

    return { id: targetId };
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
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
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
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

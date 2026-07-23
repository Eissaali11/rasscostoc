/**
 * Employee profile repository — HR extras + custody docs keyed by user_id
 */

import { eq } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  employeeProfiles,
  users,
  type EmployeeProfileData,
  type UserSafe,
} from "@shared/schema";

function toUserSafe(row: typeof users.$inferSelect): UserSafe {
  const { password: _password, ...safe } = row;
  return safe;
}

export class EmployeeProfileRepository {
  async findUserById(userId: string) {
    const db = getDatabase();
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ?? null;
  }

  async getProfileData(userId: string): Promise<EmployeeProfileData> {
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(employeeProfiles)
      .where(eq(employeeProfiles.userId, userId))
      .limit(1);
    return (row?.profileData as EmployeeProfileData) || {};
  }

  async upsertProfileData(
    userId: string,
    profileData: EmployeeProfileData,
  ): Promise<EmployeeProfileData> {
    const db = getDatabase();
    const now = new Date();
    const [row] = await db
      .insert(employeeProfiles)
      .values({
        userId,
        profileData,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: employeeProfiles.userId,
        set: {
          profileData,
          updatedAt: now,
        },
      })
      .returning();
    return (row?.profileData as EmployeeProfileData) || profileData;
  }

  async updateUserCore(
    userId: string,
    patch: { fullName?: string; city?: string | null; profileImage?: string | null },
  ): Promise<UserSafe | null> {
    const db = getDatabase();
    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.fullName !== undefined) updates.fullName = patch.fullName;
    if (patch.city !== undefined) updates.city = patch.city;
    if (patch.profileImage !== undefined) updates.profileImage = patch.profileImage;

    const [row] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    return row ? toUserSafe(row) : null;
  }
}

export const employeeProfileRepository = new EmployeeProfileRepository();

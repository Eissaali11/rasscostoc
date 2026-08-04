import type { EmployeeProfileData, UserSafe } from "@shared/schema";

export interface IEmployeeProfileRepository {
  findUserById(userId: string): Promise<any | null>;
  getProfileData(userId: string): Promise<EmployeeProfileData>;
  upsertProfileData(
    userId: string,
    profileData: EmployeeProfileData,
  ): Promise<EmployeeProfileData>;
  updateUserCore(
    userId: string,
    patch: { fullName?: string; city?: string | null; profileImage?: string | null },
  ): Promise<UserSafe | null>;
}

import { DrizzleUserRepository } from "./DrizzleUserRepository";
import { DrizzleRefreshTokenRepository } from "./DrizzleRefreshTokenRepository";
import { DrizzleAdminDashboardRepository } from "./DrizzleAdminDashboardRepository";
import { DrizzleSupervisorUsersReadRepository } from "./DrizzleSupervisorUsersReadRepository";

export const identityRepositories = {
  user: new DrizzleUserRepository(),
  refreshToken: new DrizzleRefreshTokenRepository(),
  adminDashboard: new DrizzleAdminDashboardRepository(),
  supervisorUsersRead: new DrizzleSupervisorUsersReadRepository(),
};

export type IdentityRepositories = typeof identityRepositories;
export default identityRepositories;
export * from "./UserRepository";
export * from "./DrizzleUserRepository";
export * from "./DrizzleRefreshTokenRepository";
export * from "./DrizzleAdminDashboardRepository";
export * from "./DrizzleSupervisorUsersReadRepository";

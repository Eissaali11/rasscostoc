import { DrizzleUserRepository } from "./DrizzleUserRepository";
import { DrizzleRefreshTokenRepository } from "./DrizzleRefreshTokenRepository";
import { SupervisorRepository } from "./SupervisorRepository";
import { DrizzleAdminDashboardRepository } from "./DrizzleAdminDashboardRepository";
import { DrizzleSupervisorUsersReadRepository } from "./DrizzleSupervisorUsersReadRepository";

export const identityRepositories = {
  user: new DrizzleUserRepository(),
  refreshToken: new DrizzleRefreshTokenRepository(),
  supervisor: new SupervisorRepository(),
  adminDashboard: new DrizzleAdminDashboardRepository(),
  supervisorUsersRead: new DrizzleSupervisorUsersReadRepository(),
};

export type IdentityRepositories = typeof identityRepositories;
export default identityRepositories;
export * from "./UserRepository";
export * from "./SupervisorRepository";
export * from "./DrizzleUserRepository";
export * from "./DrizzleRefreshTokenRepository";
export * from "./DrizzleAdminDashboardRepository";
export * from "./DrizzleSupervisorUsersReadRepository";

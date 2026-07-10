/**
 * IdentityService — Unified Identity Implementation
 *
 * Wraps AuthService and exposes a clean IIdentityService contract.
 * This is the single entry point for all identity operations across the platform.
 */

import { AuthService } from "./auth.service";
import type { IIdentityService, LoginCredentials, LoginResult, RefreshResult, SafeUser } from "./contracts/IIdentityService";
import { hasRoleOrAbove } from "@shared/roles";
import type { IUserRepository, IRefreshTokenRepository } from "@stockpro/contracts";

export class IdentityService implements IIdentityService {
  private readonly authService: AuthService;

  constructor(
    userRepository: IUserRepository,
    refreshTokenRepository: IRefreshTokenRepository
  ) {
    this.authService = new AuthService(userRepository, refreshTokenRepository);
  }

  async login(credentials: LoginCredentials, session?: any): Promise<LoginResult> {
    return this.authService.login(credentials, session);
  }

  async logout(token: string, session?: any, refreshToken?: string): Promise<void> {
    return this.authService.logout(token, session, refreshToken);
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    return this.authService.refresh(refreshToken);
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    return this.authService.getCurrentUser(userId);
  }

  hasRole(userRole: string, requiredRole: string): boolean {
    return hasRoleOrAbove(userRole, requiredRole);
  }
}

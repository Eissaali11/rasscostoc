/**
 * IIdentityService — Unified Identity Contract
 *
 * All modules (Courier, Inventory, Admin, etc.) must depend on this
 * interface instead of importing auth internals directly.
 * This decouples business logic from authentication implementation.
 */

import type { User } from "@shared/schema";

export type SafeUser = Omit<User, "password">;

export interface AuthUser {
  id: string;
  role: string;
  username: string;
  regionId: string | null;
  employeeCode: string | null;
  technicianCode: string | null;
  permissions: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: SafeUser;
  token: string;
  refreshToken: string;
  message: string;
}

export interface RefreshResult {
  success: boolean;
  token: string;
  refreshToken: string;
}

export interface IIdentityService {
  /** Authenticate user and issue access + refresh tokens */
  login(credentials: LoginCredentials, session?: any): Promise<LoginResult>;

  /** Logout user: destroy session and revoke refresh token */
  logout(token: string, session?: any, refreshToken?: string): Promise<void>;

  /** Rotate refresh token and issue new access token */
  refresh(refreshToken: string): Promise<RefreshResult>;

  /** Return full safe user object by user ID */
  getCurrentUser(userId: string): Promise<SafeUser>;

  /** Check if a user holds a specific role or above */
  hasRole(userRole: string, requiredRole: string): boolean;
}

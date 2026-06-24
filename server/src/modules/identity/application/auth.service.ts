/**
 * Authentication service
 */

import { hashPassword, verifyPassword } from "@server/utils/password";
import { AuthenticationError, NotFoundError } from "@core/errors/AppError";
import { loginSchema, insertUserSchema } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";
import { generateSessionToken, sessionStore } from "@core/middlewares/auth.middleware";
import { logger } from "@server/utils/logger";
import { repositories } from "@modules/inventory/infrastructure/database";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: Omit<User, "password">;
  token: string;
  message: string;
}

export class AuthService {
  /**
   * Authenticate user and create session
   */
  async login(credentials: LoginCredentials, session?: any): Promise<LoginResult> {
    const { username, password } = loginSchema.parse(credentials);

    // Find user by username
    const user = await repositories.user.getUserByUsername(username);
    if (!user) {
      throw new AuthenticationError("اسم المستخدم أو كلمة المرور غير صحيحة");
    }

    if (!user.isActive) {
      throw new AuthenticationError("الحساب غير نشط");
    }

    // Verify password (support both hashed and plain text for migration)
    const isPasswordValid = await this.verifyUserPassword(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError("اسم المستخدم أو كلمة المرور غير صحيحة");
    }

    // Return user without password
    const { password: _, ...userSafe } = user;

    // Store in Express Session (PostgreSQL-backed) - PRIMARY METHOD
    if (session) {
      session.user = {
        id: user.id,
        role: user.role,
        username: user.username,
        regionId: user.regionId || null,
      };
    }

    // Also create Bearer token for API compatibility (FALLBACK)
    const token = generateSessionToken();
    const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await sessionStore.set(token, {
      userId: user.id,
      role: user.role,
      username: user.username,
      regionId: user.regionId || null,
      expiry,
    }, expiry);

    logger.info(`User logged in: ${user.username}`, { source: "auth" });

    return {
      success: true,
      user: userSafe,
      token,
      message: "تم تسجيل الدخول بنجاح",
    };
  }

  /**
   * Logout user by invalidating session
   */
  async logout(token: string, session?: any): Promise<void> {
    // Clear Express Session (PostgreSQL)
    if (session) {
      session.destroy();
    }
    
    // Also clear Bearer token (for API compatibility)
    if (token) {
      await sessionStore.delete(token);
    }
    
    logger.info("User logged out", { source: "auth" });
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string): Promise<Omit<User, "password">> {
    const user = await repositories.user.getUser(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return user;
  }

  /**
   * Verify password - supports both hashed and plain text (for migration)
   */
  private async verifyUserPassword(
    plainPassword: string,
    storedPassword: string
  ): Promise<boolean> {
    // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (storedPassword.startsWith("$2")) {
      return verifyPassword(plainPassword, storedPassword);
    }
    // Plain text comparison (for migration purposes)
    return plainPassword === storedPassword;
  }

  /**
   * Hash password for new user creation
   */
  async hashPasswordForUser(password: string): Promise<string> {
    return hashPassword(password);
  }
}

export const authService = new AuthService();

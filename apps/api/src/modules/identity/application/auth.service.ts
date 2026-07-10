/**
 * Authentication service
 */

import crypto from "crypto";
import { AuthenticationError, NotFoundError } from "@core/errors/AppError";
import { loginSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { logger } from "@server/utils/logger";
import * as jwt from "@server/utils/jwt";
import { hashPassword as utilHashPassword, verifyPassword as utilVerifyPassword } from "@server/utils/password";
import type { IUserRepository, IRefreshTokenRepository } from "@stockpro/contracts";
import { JWT_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_DAYS } from "@core/config/jwt.config";

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository
  ) {}

  /**
   * Authenticate user, create DB-backed refresh token and JWT access token
   */
  async login(credentials: LoginCredentials, session?: any): Promise<LoginResult> {
    const { username, password } = loginSchema.parse(credentials);

    // Find user by username
    const user = await this.userRepository.getUserByUsername(username);
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

    // Generate JWT Access Token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        username: user.username,
        regionId: user.regionId || null,
        employeeCode: user.employeeCode || null,
        technicianCode: user.technicianCode || null,
        permissions: user.permissions ? JSON.parse(user.permissions) : [],
      },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN }
    );

    // Generate Refresh Token (64-character random string)
    const refreshTokenString = crypto.randomBytes(32).toString("hex");
    const refreshTokenExpiry = new Date(Date.now() + JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    // Store Refresh Token in Database
    await this.refreshTokenRepository.create(
      refreshTokenString,
      user.id,
      refreshTokenExpiry
    );

    // Store in Express Session (PostgreSQL-backed) - PRIMARY METHOD for web fallback
    if (session) {
      session.user = {
        id: user.id,
        role: user.role,
        username: user.username,
        regionId: user.regionId || null,
        employeeCode: user.employeeCode || null,
        technicianCode: user.technicianCode || null,
        permissions: user.permissions ? JSON.parse(user.permissions) : [],
      };
    }

    logger.info(`User logged in via SSO: ${user.username}`, { source: "auth" });

    return {
      success: true,
      user: userSafe,
      token: accessToken,
      refreshToken: refreshTokenString,
      message: "تم تسجيل الدخول بنجاح",
    };
  }

  /**
   * Refresh token rotation (RTR) - issues new JWT and new Refresh Token
   */
  async refresh(tokenString: string): Promise<RefreshResult> {
    const record = await this.refreshTokenRepository.getByToken(tokenString);
    if (!record) {
      throw new AuthenticationError("رمز التحديث غير صالح");
    }

    // Check if token is revoked
    if (record.isRevoked) {
      // Threat detected! Token reuse means token was compromised.
      // Revoke all refresh tokens for this user immediately as a precaution.
      await this.refreshTokenRepository.revokeAllForUser(record.userId);
      logger.warn(`Security alert: Revoked refresh token reuse detected for user ${record.userId}. All active sessions invalidated.`, { source: "auth" });
      throw new AuthenticationError("تم الكشف عن محاولة إعادة استخدام رمز ملغى. تم إلغاء جميع الجلسات لدواعي الأمان.");
    }

    // Check if token is expired
    if (new Date() > new Date(record.expiry)) {
      throw new AuthenticationError("انتهت صلاحية رمز التحديث، الرجاء تسجيل الدخول مرة أخرى");
    }

    // Fetch user details
    const user = await this.userRepository.getUser(record.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError("المستخدم غير موجود أو غير نشط");
    }

    // Generate new Access Token
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        username: user.username,
        regionId: user.regionId || null,
        employeeCode: user.employeeCode || null,
        technicianCode: user.technicianCode || null,
        permissions: user.permissions ? JSON.parse(user.permissions) : [],
      },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN }
    );

    // Generate new Refresh Token (Rotation)
    const newRefreshTokenString = crypto.randomBytes(32).toString("hex");
    const newRefreshTokenExpiry = new Date(Date.now() + JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    // Revoke old token and link to new one in transaction-like sequence
    await this.refreshTokenRepository.revoke(tokenString, newRefreshTokenString);
    await this.refreshTokenRepository.create(newRefreshTokenString, user.id, newRefreshTokenExpiry);

    logger.info(`Session token rotated for user: ${user.username}`, { source: "auth" });

    return {
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshTokenString,
    };
  }

  /**
   * Logout user by invalidating session and revoking refresh token
   */
  async logout(token: string, session?: any, refreshTokenString?: string): Promise<void> {
    // Clear Express Session (PostgreSQL)
    if (session) {
      session.destroy();
    }

    // Revoke the refresh token in the database
    if (refreshTokenString) {
      await this.refreshTokenRepository.revoke(refreshTokenString);
    }

    logger.info("User logged out and session revoked", { source: "auth" });
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string): Promise<Omit<User, "password">> {
    const user = await this.userRepository.getUser(userId);
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
      return utilVerifyPassword(plainPassword, storedPassword);
    }
    // Plain text comparison (for migration purposes)
    return plainPassword === storedPassword;
  }

  /**
   * Hash password for new user creation
   */
  async hashPasswordForUser(password: string): Promise<string> {
    return utilHashPassword(password);
  }
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: Omit<User, "password">;
  token: string;
  refreshToken: string;
  message: string;
}

export interface RefreshResult {
  success: boolean;
  token: string;
  refreshToken: string;
}

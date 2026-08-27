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
import type { IIdentityUnitOfWork } from "../domain/repositories/IIdentityUnitOfWork";

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly identityUnitOfWork: IIdentityUnitOfWork
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

    // ERP-008-P1.3: bcrypt-only — plaintext fallback removed
    const isPasswordValid = await this.verifyUserPassword(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError("اسم المستخدم أو كلمة المرور غير صحيحة");
    }

    // Return user without password
    const { password: _, ...userSafe } = user;

    // Single, immutable snapshot of the account's credential generation for this
    // authentication event. Every credential issued below carries exactly this
    // value — never a value re-read later — so a concurrent deactivation cannot
    // retroactively upgrade an already-authenticated login to a newer generation,
    // and a credential physically persisted after a deactivation's revocation
    // sweep still carries the stale generation and fails the next comparison.
    const authGeneration = user.authGeneration;

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
        authGeneration,
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
      refreshTokenExpiry,
      authGeneration
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
        authGeneration,
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
   * Refresh token rotation (RTR) - issues new JWT and new Refresh Token.
   *
   * Every check that decides whether to issue a new credential runs inside one
   * transaction, against row-locked, freshly-read state — never against the
   * pre-transaction lookup below, which exists only to locate which rows to
   * lock. This closes two races that a lock-only design (locking just the
   * users row) cannot: (1) a deactivation committing between this method's
   * start and its transaction, which must be observed by a fresh in-tx reread
   * of the token's revocation state, not the stale pre-tx read; and (2) two
   * concurrent refreshes of the same token, which the token row's own
   * FOR UPDATE serializes so only the first can succeed.
   */
  async refresh(tokenString: string): Promise<RefreshResult> {
    // Not security-authoritative — used only to fail fast before opening a
    // transaction when the token obviously doesn't exist.
    const preCheck = await this.refreshTokenRepository.getByToken(tokenString);
    if (!preCheck) {
      throw new AuthenticationError("رمز التحديث غير صالح");
    }

    return this.identityUnitOfWork.execute(async (ctx) => {
      const lockedUser = await ctx.lockUserForUpdate(preCheck.userId);
      const record = await ctx.refreshTokenRepository.getByTokenForUpdate(tokenString);

      if (!record || record.userId !== preCheck.userId) {
        throw new AuthenticationError("رمز التحديث غير صالح");
      }

      if (record.isRevoked) {
        // Threat detected! Token reuse means token was compromised.
        // Revoke all refresh tokens for this user immediately as a precaution.
        await ctx.refreshTokenRepository.revokeAllForUser(record.userId);
        logger.warn(`Security alert: Revoked refresh token reuse detected for user ${record.userId}. All active sessions invalidated.`, { source: "auth" });
        throw new AuthenticationError("تم الكشف عن محاولة إعادة استخدام رمز ملغى. تم إلغاء جميع الجلسات لدواعي الأمان.");
      }

      if (new Date() > new Date(record.expiry)) {
        throw new AuthenticationError("انتهت صلاحية رمز التحديث، الرجاء تسجيل الدخول مرة أخرى");
      }

      if (!lockedUser || !lockedUser.isActive) {
        throw new AuthenticationError("المستخدم غير موجود أو غير نشط");
      }

      // The credential's own generation must match the account's CURRENT
      // generation, not merely "not revoked" — a row created after a
      // deactivation's revocation sweep was never revoked, but it was born
      // carrying the stale pre-deactivation generation and must still fail.
      if (record.authGeneration !== lockedUser.authGeneration) {
        throw new AuthenticationError("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مرة أخرى");
      }

      const user = await ctx.userRepository.getUser(record.userId);
      if (!user) {
        throw new AuthenticationError("المستخدم غير موجود أو غير نشط");
      }

      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          username: user.username,
          regionId: user.regionId || null,
          employeeCode: user.employeeCode || null,
          technicianCode: user.technicianCode || null,
          permissions: user.permissions ? JSON.parse(user.permissions) : [],
          authGeneration: lockedUser.authGeneration,
        },
        JWT_SECRET,
        { expiresIn: JWT_ACCESS_EXPIRES_IN }
      );

      const newRefreshTokenString = crypto.randomBytes(32).toString("hex");
      const newRefreshTokenExpiry = new Date(Date.now() + JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

      await ctx.refreshTokenRepository.revoke(tokenString, newRefreshTokenString);
      await ctx.refreshTokenRepository.create(
        newRefreshTokenString,
        user.id,
        newRefreshTokenExpiry,
        lockedUser.authGeneration
      );

      logger.info(`Session token rotated for user: ${user.username}`, { source: "auth" });

      return {
        success: true,
        token: newAccessToken,
        refreshToken: newRefreshTokenString,
      };
    });
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
   * FCM push tokens are not part of the ERP-008 baseline schema (75ca707).
   * Keep API surface callable for forward compatibility without writing unknown columns.
   */
  async updateFcmToken(_userId: string, _fcmToken: string): Promise<void> {
    logger.warn("FCM token update ignored: users.fcm_token is not in baseline schema", {
      source: "auth",
      code: "FCM_TOKEN_UNSUPPORTED",
    });
  }

  /**
   * Clear FCM Token for user (logout / unregister device)
   */
  async clearFcmToken(_userId: string): Promise<void> {
    logger.warn("FCM token clear ignored: users.fcm_token is not in baseline schema", {
      source: "auth",
      code: "FCM_TOKEN_UNSUPPORTED",
    });
  }

  private async verifyUserPassword(
    plainPassword: string,
    storedPassword: string
  ): Promise<boolean> {
    // ERP-008-P1.3: refuse non-bcrypt stored credentials (no plaintext fallback).
    // Legacy rows must be migrated via scripts/migrate-plaintext-passwords.ts
    if (!storedPassword || !storedPassword.startsWith("$2")) {
      logger.warn("Login blocked: stored password is not a bcrypt hash", {
        source: "auth",
        code: "PLAINTEXT_PASSWORD_REJECTED",
      });
      return false;
    }
    return utilVerifyPassword(plainPassword, storedPassword);
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

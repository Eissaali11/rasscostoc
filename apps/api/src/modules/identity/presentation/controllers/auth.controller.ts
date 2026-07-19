/**
 * Authentication controller
 */

import type { Request, Response } from "express";
import { authService } from "@server/composition/auth.container";
import { asyncHandler } from "@core/errors/errorHandler";
import { requireAuth } from "@core/middlewares/auth.middleware";
import {
  setAuthCookies,
  clearAuthCookies,
  readCookie,
  REFRESH_COOKIE,
} from "@core/config/auth-cookies";

export class AuthController {
  /**
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    // Regenerate session to prevent session fixation
    if (req.session) {
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    const result = await authService.login(req.body, req.session);
    // Additive: also issue httpOnly cookies. The JSON body (token/refreshToken)
    // is still returned so the existing Bearer/localStorage flow keeps working.
    if (result.success && result.token && result.refreshToken) {
      setAuthCookies(res, { token: result.token, refreshToken: result.refreshToken });
    }
    res.json(result);
  });

  /**
   * POST /api/auth/refresh
   */
  refresh = asyncHandler(async (req: Request, res: Response) => {
    // Accept the refresh token from the body (current frontend) or the
    // httpOnly cookie (future cookie-only clients).
    const refreshToken = req.body?.refreshToken || readCookie(req, REFRESH_COOKIE);
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "رمز التحديث مطلوب" });
    }
    const result = await authService.refresh(refreshToken);
    if (result.success && result.token && result.refreshToken) {
      setAuthCookies(res, { token: result.token, refreshToken: result.refreshToken });
    }
    res.json(result);
  });

  /**
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const refreshToken = req.body?.refreshToken || readCookie(req, REFRESH_COOKIE);

    await authService.logout(token || "", req.session, refreshToken);
    clearAuthCookies(res);

    res.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  });

  /**
   * GET /api/auth/me
   */
  getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await authService.getCurrentUser(userId);
    res.json({ user });
  });
}

export const authController = new AuthController();

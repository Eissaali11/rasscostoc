/**
 * Authentication controller
 */

import type { Request, Response } from "express";
import { authService } from "@modules/identity/application/auth.service";
import { asyncHandler } from "@core/errors/errorHandler";
import { requireAuth } from "@core/middlewares/auth.middleware";

export class AuthController {
  /**
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, req.session);
    res.json(result);
  });

  /**
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    await authService.logout(token || "", req.session);

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

/**
 * Authentication routes
 */

import type { Express } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { loginRateLimit } from "@core/middlewares/login-rate-limit";
import { validateBody } from "@core/middlewares/validation";
import { loginSchema } from "@shared/schema";

export function registerAuthRoutes(app: Express): void {
  // Login — dedicated brute-force lockout runs before validation/auth.
  app.post(
    "/api/auth/login",
    loginRateLimit,
    validateBody(loginSchema),
    authController.login
  );

  // Refresh Token
  app.post("/api/auth/refresh", authController.refresh);

  // Logout
  app.post("/api/auth/logout", requireAuth, authController.logout);

  // Get current user
  app.get("/api/auth/me", requireAuth, authController.getMe);

  // Mint a short-lived token for cross-app SSO handoff (cookie-authenticated)
  app.get("/api/auth/sso-token", requireAuth, authController.ssoToken);
}

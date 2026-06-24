/**
 * Users routes
 */

import type { Express } from "express";
import { usersController } from "../controllers/users.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { insertUserSchema } from "@shared/schema";

export function registerUsersRoutes(app: Express): void {
  // Get all users
  app.get("/api/users", requireAuth, requireAdmin, usersController.getAll);

  // Get single user
  app.get("/api/users/:id", usersController.getById);

  // Create new user
  app.post(
    "/api/users",
    requireAuth,
    requireAdmin,
    validateBody(insertUserSchema),
    usersController.create
  );

  // Update user
  app.patch(
    "/api/users/:id",
    requireAuth,
    requireAdmin,
    validateBody(insertUserSchema.partial()),
    usersController.update
  );

  // Delete user
  app.delete("/api/users/:id", requireAuth, requireAdmin, usersController.delete);
}

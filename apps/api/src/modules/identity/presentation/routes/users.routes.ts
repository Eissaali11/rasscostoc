/**
 * Users routes
 */

import type { Express } from "express";
import { usersController } from "../controllers/users.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { insertUserSchema } from "@shared/schema";

import { employeeProfileController } from "../controllers/employee-profile.controller";

export function registerUsersRoutes(app: Express): void {
  // Get all users
  app.get("/api/users", requireAuth, requireAdmin, usersController.getAll);

  // Employee detailed profile (portal ↔ mobile sync) — before :id catch-alls
  app.get(
    "/api/users/:id/employee-profile",
    requireAuth,
    employeeProfileController.get,
  );
  app.put(
    "/api/users/:id/employee-profile",
    requireAuth,
    employeeProfileController.upsert,
  );

  // Get single user — PLATFORM-P0: auth + authorization enforced in controller
  app.get("/api/users/:id", requireAuth, usersController.getById);

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

  // Bulk status update
  app.post(
    "/api/users/bulk-status",
    requireAuth,
    requireAdmin,
    usersController.bulkStatus
  );
}

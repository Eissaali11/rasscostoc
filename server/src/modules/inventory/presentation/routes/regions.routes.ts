/**
 * Regions routes
 */

import type { Express } from "express";
import { regionsController } from "../controllers/regions.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { insertRegionSchema } from "@shared/schema";

export function registerRegionsRoutes(app: Express): void {
  // Get all regions
  app.get("/api/regions", requireAuth, regionsController.getAll);

  // Get single region
  app.get("/api/regions/:id", regionsController.getById);

  // Create new region
  app.post(
    "/api/regions",
    requireAuth,
    requireAdmin,
    validateBody(insertRegionSchema),
    regionsController.create
  );

  // Update region
  app.patch(
    "/api/regions/:id",
    requireAuth,
    requireAdmin,
    validateBody(insertRegionSchema.partial()),
    regionsController.update
  );

  // Delete region
  app.delete(
    "/api/regions/:id",
    requireAuth,
    requireAdmin,
    regionsController.delete
  );
}

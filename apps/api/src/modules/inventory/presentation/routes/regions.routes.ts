/**
 * Regions routes
 */

import type { Express } from "express";
import { regionsContainer } from "@server/composition/regions.container";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { validateBody } from "@core/middlewares/validation";
import { insertRegionSchema } from "@shared/schema";

export function registerRegionsRoutes(app: Express): void {
  const controller = regionsContainer.regionsController;

  // Get all regions
  app.get("/api/regions", requireAuth, controller.getAll);

  // Get single region
  app.get("/api/regions/:id", controller.getById);

  // Create new region
  app.post(
    "/api/regions",
    requireAuth,
    requireAdmin,
    validateBody(insertRegionSchema),
    controller.create
  );

  // Update region
  app.patch(
    "/api/regions/:id",
    requireAuth,
    requireAdmin,
    validateBody(insertRegionSchema.partial()),
    controller.update
  );

  // Delete region
  app.delete(
    "/api/regions/:id",
    requireAuth,
    requireAdmin,
    controller.delete
  );
}

/**
 * Dashboard routes
 */

import type { Express } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";

export function registerDashboardRoutes(app: Express): void {
  // Get public stats & catalog
  app.get("/api/public/stock", dashboardController.getPublicStock);

  // Get dashboard stats
  app.get("/api/dashboard", dashboardController.getStats);

  // Get admin stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, dashboardController.getAdminStats);
}

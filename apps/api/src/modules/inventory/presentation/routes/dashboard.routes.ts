/**
 * Dashboard routes
 */

import type { Express } from "express";
import { dashboardContainer } from "@server/composition/dashboard.container";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";

export function registerDashboardRoutes(app: Express): void {
  const controller = dashboardContainer.dashboardController;

  // Get public stats & catalog
  app.get("/api/public/stock", controller.getPublicStock);

  // Get dashboard stats
  app.get("/api/dashboard", requireAuth, controller.getStats);

  // Get admin stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, controller.getAdminStats);
}

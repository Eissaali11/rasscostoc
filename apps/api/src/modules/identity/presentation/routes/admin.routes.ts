import type { Express } from "express";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { adminDashboardContainer } from "@server/composition/admin-dashboard.container";

/**
 * Admin Routes - Administrative functions and dashboards
 */
export function registerAdminRoutes(app: Express): void {
  // Admin fixed inventory dashboard
  app.get("/api/admin/fixed-inventory-dashboard", requireAuth, requireAdmin, async (req, res) => {
    try {
      const dashboard = await adminDashboardContainer.getFixedInventoryDashboardUseCase.execute();
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fixed inventory dashboard" });
    }
  });

  // Admin all technicians inventory
  app.get("/api/admin/all-technicians-inventory", requireAuth, requireAdmin, async (req, res) => {
    try {
      const inventory = await adminDashboardContainer.getAllTechniciansInventoryUseCase.execute();
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching all technicians inventory:", error);
      res.status(500).json({ message: "Failed to fetch technicians inventory" });
    }
  });

  // Admin inventory requests
  app.get("/api/inventory-requests", requireAuth, requireAdmin, async (req, res) => {
    try {
      const requests = await adminDashboardContainer.getAdminInventoryRequestsUseCase.execute();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching inventory requests:", error);
      res.status(500).json({ message: "Failed to fetch inventory requests" });
    }
  });

  // Admin pending inventory requests count
  app.get("/api/inventory-requests/pending/count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const count = await adminDashboardContainer.getPendingInventoryRequestsCountUseCase.execute();
      res.json(count);
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });
}
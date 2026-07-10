import type { Express } from "express";
import { techniciansController } from "@modules/inventory/presentation/controllers/technicians.controller";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";

/**
 * Technicians Supervisor Routes - نقاط خاصة بالمشرف (<100 سطر)
 */
export function registerTechniciansAdminRoutes(app: Express): void {
  // Supervisor: supervisors' technicians with inventories
  app.get(
    "/api/supervisor/technicians-inventory",
    requireAuth,
    requireSupervisor,
    techniciansController.getSupervisorTechniciansInventory
  );
}

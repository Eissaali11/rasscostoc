import type { Express } from "express";
import { techniciansController } from "@modules/inventory/presentation/controllers/technicians.controller";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";

/**
 * Technicians Profile Routes - معلومات المندوبين وملفاتهم (<100 سطر)
 */
export function registerTechniciansProfileRoutes(app: Express): void {
  // Get all technicians
  app.get("/api/technicians", requireAuth, techniciansController.getAll);

  // Get supervisor's technicians
  app.get(
    "/api/supervisor/technicians",
    requireAuth,
    requireSupervisor,
    techniciansController.getSupervisorTechnicians
  );

  // Get single technician
  app.get("/api/technicians/:id", requireAuth, techniciansController.getById);
}


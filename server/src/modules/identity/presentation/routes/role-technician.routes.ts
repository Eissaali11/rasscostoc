import type { Express } from "express";
import { registerTechniciansProfileRoutes } from "./technicians-profile.routes";
import { registerTechniciansInventoryRoutes } from "@modules/inventory/presentation/routes/technicians-inventory.routes";
import { registerInventoryRequestsCreateRoutes } from "@modules/inventory/presentation/routes/inventory-requests-create.routes";
import { RepresentativeInventoryRouter } from "../../../inventory/presentation/http/representative_inventory.routes";
import { DrizzleInventoryV2UnitOfWork } from "../../../inventory/infrastructure/database/DrizzleInventoryV2UnitOfWork";

/**
 * Technician Role Routes
 * Routes grouped by technician responsibility
 */
export function registerTechnicianRoleRoutes(app: Express): void {
  registerTechniciansProfileRoutes(app);
  registerTechniciansInventoryRoutes(app);
  registerInventoryRequestsCreateRoutes(app);

  // Register modern representative inventory (V2) routes
  const unitOfWork = new DrizzleInventoryV2UnitOfWork();
  const representativeRouter = new RepresentativeInventoryRouter(unitOfWork);
  representativeRouter.register(app);
}

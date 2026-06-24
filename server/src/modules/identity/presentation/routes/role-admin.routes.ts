import type { Express } from "express";
import { registerAdminRoutes } from "./admin.routes";
import { registerUsersRoutes } from "./users.routes";
import { registerRegionsRoutes } from "@modules/inventory/presentation/routes/regions.routes";
import { registerItemTypesRoutes } from "@modules/inventory/presentation/routes/item-types.routes";
import { registerSystemRoutes } from "@modules/inventory/presentation/routes/system.routes";
import { registerDashboardRoutes } from "@modules/inventory/presentation/routes/dashboard.routes";

/**
 * Admin Role Routes
 * Routes grouped by admin responsibility
 */
export function registerAdminRoleRoutes(app: Express): void {
  registerAdminRoutes(app);
  registerUsersRoutes(app);
  registerRegionsRoutes(app);
  registerItemTypesRoutes(app);
  registerSystemRoutes(app);
  registerDashboardRoutes(app);
}

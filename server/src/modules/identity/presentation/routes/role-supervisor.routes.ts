import type { Express } from "express";
import { registerSupervisorTechniciansListRoutes } from "@modules/inventory/presentation/routes/supervisor-technicians-list.routes";
import { registerSupervisorUsersRoutes } from "@modules/inventory/presentation/routes/supervisor-users.routes";
import { registerSupervisorRequestsRoutes } from "@modules/inventory/presentation/routes/supervisor-requests.routes";
import { registerSupervisorAssignmentsRoutes } from "@modules/inventory/presentation/routes/supervisor-assignments.routes";

/**
 * Supervisor Role Routes
 * Routes grouped by supervisor responsibility
 */
export function registerSupervisorRoleRoutes(app: Express): void {
  registerSupervisorTechniciansListRoutes(app);
  registerSupervisorUsersRoutes(app);
  registerSupervisorRequestsRoutes(app);
  registerSupervisorAssignmentsRoutes(app);
}

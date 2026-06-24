import type { Express } from "express";

export async function registerRefactoredRoutes(app: Express) {
  const { registerAdminRoleRoutes } = await import("@modules/identity/presentation/routes/role-admin.routes");
  registerAdminRoleRoutes(app);

  const { registerSupervisorRoleRoutes } = await import("@modules/identity/presentation/routes/role-supervisor.routes");
  registerSupervisorRoleRoutes(app);

  const { registerTechnicianRoleRoutes } = await import("@modules/identity/presentation/routes/role-technician.routes");
  registerTechnicianRoleRoutes(app);

  const { registerCommonRoleRoutes } = await import("@modules/identity/presentation/routes/role-common.routes");
  registerCommonRoleRoutes(app);
}

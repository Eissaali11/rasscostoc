import type { Express } from "express";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { PermissionsController } from "../controllers/permissions.controller";

/**
 * OPS-PERM-S1-F4 §8 — Permissions Center backend API.
 * Every route is admin-only. Writes are additionally re-validated inside PermissionsService
 * (self-edit, target role, hard ceiling) — this middleware chain is the coarse gate, not the
 * authority (OPS-PERM-S1-F4 §11: no authorization logic in controllers/routes).
 */
export function registerPermissionsRoutes(app: Express): void {
  const controller = new PermissionsController();

  app.get("/api/admin/permissions/employees/:userId", requireAuth, requireAdmin, controller.getEmployeeSnapshot);
  app.get("/api/admin/permissions/employees/:userId/audit", requireAuth, requireAdmin, controller.getAuditHistory);
  app.post("/api/admin/permissions/employees/:userId/grant", requireAuth, requireAdmin, controller.grant);
  app.post("/api/admin/permissions/employees/:userId/revoke", requireAuth, requireAdmin, controller.revoke);
  app.post("/api/admin/permissions/employees/:userId/reset", requireAuth, requireAdmin, controller.reset);
}

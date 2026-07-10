import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { supervisorRequestsController } from "../controllers/supervisor-requests.controller";

/**
 * Supervisor Requests Routes - طلبات المخزون (< 100 lines)
 * مجال المسؤولية: إدارة طلبات المخزون للمندوبين في المنطقة فقط
 */
export function registerSupervisorRequestsRoutes(app: Express): void {

  // عرض جميع طلبات المخزون في المنطقة
  app.get("/api/supervisor/inventory-requests", requireAuth, requireSupervisor, supervisorRequestsController.getRequests);

  // عدد الطلبات المعلقة في المنطقة
  app.get("/api/supervisor/inventory-requests/pending/count", requireAuth, requireSupervisor, supervisorRequestsController.getPendingCount);
}
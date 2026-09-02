import type { Express, NextFunction, Request, Response } from "express";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { AuthorizationError, AppError } from "@core/errors/AppError";
import { isAdmin } from "@shared/roles";
import { supervisorAssignmentsContainer } from "@server/composition/supervisor-assignments.container";

/**
 * OPS-PERM-S1-F1.R2.SR1 — these two GET endpoints return a supervisor's
 * assignment relationships (which technicians/warehouses they manage) keyed
 * entirely by a client-supplied :supervisorId. Object-level authorization
 * must confirm the caller IS that supervisor (or an admin) before this
 * relationship data is returned — a coarse role check alone (e.g.
 * requireSupervisor) is not sufficient, since it does not verify the caller
 * owns the specific supervisorId in the URL. Any other supervisor, and every
 * non-admin/non-owning role, is denied regardless of region — this is a
 * narrow identity check, not a scope policy in its own right.
 */
function requireOwnSupervisorAssignmentsOrAdmin(req: Request, _res: Response, next: NextFunction): void {
  const actor = req.user!;
  if (isAdmin(actor.role) || actor.id === req.params.supervisorId) {
    return next();
  }
  next(new AuthorizationError("لا يمكنك الوصول إلى ارتباطات مشرف آخر"));
}

export function registerSupervisorAssignmentsRoutes(app: Express) {

  // ===================== Supervisor Technician Assignments =====================
  
  app.post("/api/supervisors/:supervisorId/technicians/:technicianId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const assignment = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.assignTechnician(
        req.params.supervisorId,
        req.params.technicianId
      );
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning technician to supervisor:", error);
      res.status(500).json({ message: "Failed to assign technician" });
    }
  });

  app.delete("/api/supervisors/:supervisorId/technicians/:technicianId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const removed = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.removeTechnician(
        req.params.supervisorId,
        req.params.technicianId
      );
      if (!removed) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing technician from supervisor:", error);
      res.status(500).json({ message: "Failed to remove technician" });
    }
  });

  app.get("/api/supervisors/:supervisorId/technicians", requireAuth, requireOwnSupervisorAssignmentsOrAdmin, async (req, res) => {
    try {
      const technicianIds = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.getTechnicianIdsBySupervisor(
        req.params.supervisorId
      );
      res.json(technicianIds);
    } catch (error) {
      console.error("Error fetching supervisor technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });

  // ===================== Supervisor Warehouse Assignments =====================
  
  app.post("/api/supervisors/:supervisorId/warehouses/:warehouseId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const assignment = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.assignWarehouse(
        req.params.supervisorId,
        req.params.warehouseId
      );
      res.status(201).json(assignment);
    } catch (error) {
      // OPS-PERM-S1-F1.R2.SR2 Defect B — map the domain error by TYPE, never by
      // message text. An earlier revision matched on Arabic substrings and
      // silently turned the two null-region invariants into uncontrolled 500s;
      // the security suite caught it. AppError carries its own statusCode, so
      // any invariant added to the writer later is mapped correctly for free.
      if (error instanceof AppError) {
        console.error("Warehouse assignment rejected:", error.name, error.message);
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error assigning warehouse to supervisor:", error);
      res.status(500).json({ message: "Failed to assign warehouse" });
    }
  });

  app.delete("/api/supervisors/:supervisorId/warehouses/:warehouseId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const removed = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.removeWarehouse(
        req.params.supervisorId,
        req.params.warehouseId
      );
      if (!removed) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing warehouse from supervisor:", error);
      res.status(500).json({ message: "Failed to remove warehouse" });
    }
  });

  app.get("/api/supervisors/:supervisorId/warehouses", requireAuth, requireOwnSupervisorAssignmentsOrAdmin, async (req, res) => {
    try {
      const warehouseIds = await supervisorAssignmentsContainer.supervisorAssignmentsUseCase.getWarehouseIdsBySupervisor(
        req.params.supervisorId
      );
      res.json(warehouseIds);
    } catch (error) {
      console.error("Error fetching supervisor warehouses:", error);
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });
}
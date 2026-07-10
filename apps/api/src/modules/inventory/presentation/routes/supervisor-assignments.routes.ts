import type { Express } from "express";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { supervisorAssignmentsContainer } from "@server/composition/supervisor-assignments.container";

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

  app.get("/api/supervisors/:supervisorId/technicians", requireAuth, async (req, res) => {
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

  app.get("/api/supervisors/:supervisorId/warehouses", requireAuth, async (req, res) => {
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
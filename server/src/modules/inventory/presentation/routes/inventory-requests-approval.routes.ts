import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { inventoryRequestsApprovalContainer } from "@server/composition/inventory-requests-approval.container";
import { InventoryRequestApprovalError } from "@modules/inventory/application/inventory-requests/use-cases/InventoryRequestApproval.errors";

/**
 * Inventory Requests Approval Routes
 * Legacy-compatible approve/reject endpoints required by current clients.
 */
export function registerInventoryRequestsApprovalRoutes(app: Express): void {
  app.patch("/api/inventory-requests/:id/approve", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      const { adminNotes, warehouseId } = req.body;

      if (!warehouseId) {
        return res.status(400).json({ message: "Warehouse ID is required" });
      }

      const updatedRequest = await inventoryRequestsApprovalContainer.approveInventoryRequestUseCase.execute({
        requestId: req.params.id,
        warehouseId,
        adminNotes,
        actor: {
          id: user.id,
          role: user.role,
          regionId: user.regionId,
        },
      });

      res.json(updatedRequest);
    } catch (error) {
      if (error instanceof InventoryRequestApprovalError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error approving request:", error);
      res.status(500).json({ message: "Failed to approve request" });
    }
  });

  app.patch("/api/inventory-requests/:id/reject", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      const { adminNotes } = req.body;

      if (!adminNotes) {
        return res.status(400).json({ message: "Admin notes are required for rejection" });
      }

      const updatedRequest = await inventoryRequestsApprovalContainer.rejectInventoryRequestUseCase.execute({
        requestId: req.params.id,
        adminNotes,
        actor: {
          id: user.id,
          role: user.role,
          regionId: user.regionId,
        },
      });

      res.json(updatedRequest);
    } catch (error) {
      if (error instanceof InventoryRequestApprovalError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error rejecting request:", error);
      res.status(500).json({ message: "Failed to reject request" });
    }
  });
}

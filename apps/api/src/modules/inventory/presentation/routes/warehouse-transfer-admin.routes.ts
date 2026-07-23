import type { Express } from "express";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { inventoryContainer } from "@server/composition/inventory.container";

/**
 * Warehouse Transfer Admin Routes
 * Endpoints restricted to admin operations.
 */
export function registerWarehouseTransferAdminRoutes(app: Express): void {
  app.delete("/api/warehouse-transfers/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await inventoryContainer.deleteWarehouseTransfersUseCase.execute({ ids: [id] });
      res.json(result);
    } catch (error) {
      console.error("Error deleting transfer:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete transfer" });
    }
  });

  app.delete("/api/warehouse-transfers", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      const result = await inventoryContainer.deleteWarehouseTransfersUseCase.execute({ ids });
      res.json(result);
    } catch (error) {
      console.error("Error deleting transfers:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete transfers" });
    }
  });
}

import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { inventoryContainer } from "@server/composition/inventory.container";
import { GetWarehouseInventoryUseCaseError } from "@modules/inventory/application/inventory/use-cases/GetWarehouseInventory.use-case";

/**
 * Warehouse Stock Movement Routes - حركات المخزون في المستودعات (< 100 lines)  
 * مجال المسؤولية: عرض حركات المخزون ومخزون المستودعات
 */
export function registerWarehouseStockMovementRoutes(app: Express): void {

  // عرض حركات المخزون حسب صلاحية المستخدم
  app.get("/api/stock-movements", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const movements = await inventoryContainer.getStockMovementsUseCase.execute({
        actor: {
          id: user.id,
          role: user.role,
          regionId: user.regionId,
        },
      });

      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });

  // عرض مخزون مستودع محدد
  app.get("/api/warehouse-inventory/:warehouseId", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = req.user!;
      const inventory = await inventoryContainer.getWarehouseInventoryUseCase.execute({
        actor: {
          id: user.id,
          role: user.role,
        },
        warehouseId: req.params.warehouseId,
      });
      
      res.json(inventory);
    } catch (error) {
      if (error instanceof GetWarehouseInventoryUseCaseError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error("Error fetching warehouse inventory:", error);
      res.status(500).json({ message: "Failed to fetch warehouse inventory" });
    }
  });
}
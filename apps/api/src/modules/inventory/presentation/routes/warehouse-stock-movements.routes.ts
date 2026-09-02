import type { Express } from "express";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryContainer } from "@server/composition/inventory.container";

/**
 * Warehouse Stock Movement Routes - حركات المخزون في المستودعات (< 100 lines)
 * مجال المسؤولية: عرض حركات المخزون
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

  // OPS-PERM-S1-F1.R2.SR2/SR3 — R2 remediation.
  //
  // GET /api/warehouse-inventory/:warehouseId was ALSO registered here, with a
  // handler that resolved the warehouse-scope decision from { id, role } only —
  // it never passed actor.regionId, so it applied the pre-SR2 relation-only
  // rule and would have admitted a cross-region supervisor.
  //
  // Because warehouses.routes.ts registers the same method+path earlier (see
  // routes/index.ts) and its handler ends the response, this registration was
  // already unreachable — but that made the security outcome a consequence of
  // Express registration order rather than of the authorization policy. The
  // duplicate is removed so that exactly ONE registration of this path exists
  // and it is the canonical warehouse-scope seam in warehouses.routes.ts.
  //
  // Removing it is behaviour-preserving: no request ever reached this handler.
}
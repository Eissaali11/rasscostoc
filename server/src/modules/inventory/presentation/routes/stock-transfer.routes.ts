import type { Express } from "express";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { z } from "zod";
import { stockTransferContainer } from "@server/composition/stock-transfer.container";

const stockTransferSchema = z.object({
  technicianId: z.string(),
  itemType: z.string(),
  packagingType: z.enum(["box", "unit"]),
  quantity: z.number().positive(),
  fromInventory: z.enum(["fixed", "moving"]),
  toInventory: z.enum(["fixed", "moving"]),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Stock Transfer Routes - نقل المخزون و الحركات (< 100 lines)
 * مجال المسؤولية: نقل المخزون بين أنواع المخزون المختلفة وتتبع الحركات
 */
export function registerStockTransferRoutes(app: Express): void {

  // نقل المخزون بين المخازن
  app.post("/api/stock-transfer", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const transferData = stockTransferSchema.parse(req.body);
      
      const result = await stockTransferContainer.stockTransferUseCase.transfer({
        ...transferData,
        performedBy: user.id,
      });
      
      // Log the transfer activity
      await stockTransferContainer.createSystemLogUseCase.execute({
        userId: user.id,
        userName: user.fullName || user.username || 'Unknown',
        userRole: user.role,
        regionId: null,
        action: 'transfer',
        entityType: 'stock_transfer',
        entityId: transferData.technicianId,
        entityName: transferData.itemType,
        description: `نقل مخزون: ${transferData.quantity} ${transferData.packagingType} من ${transferData.fromInventory} إلى ${transferData.toInventory}`,
        severity: 'info',
        success: true,
        details: JSON.stringify({
          itemType: transferData.itemType,
          quantity: transferData.quantity,
          packagingType: transferData.packagingType,
          fromInventory: transferData.fromInventory,
          toInventory: transferData.toInventory,
          reason: transferData.reason,
        }),
      });
      
      res.json(result);
    } catch (error) {
      console.error("Stock transfer error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transfer data", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to process stock transfer" });
    }
  });

  // عرض حركات المخزون
  app.get("/api/stock-movements", requireAuth, async (req, res) => {
    try {
      const movements = await stockTransferContainer.stockTransferUseCase.getMovements();
      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Failed to fetch stock movements" });
    }
  });
}
import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryScanService, InventoryScanError } from "@modules/inventory/application/inventory-scan.service";

const executeInventoryScanSchema = z.object({
  source: z.enum(["scanner", "mobile"]),
  operationType: z.enum([
    "ADD_STOCK",
    "DEDUCT_STOCK",
    "TRANSFER_TO_TECHNICIAN",
    "WITHDRAW_FROM_TECHNICIAN",
  ]),
  itemCode: z.string().trim().min(1),
  packagingType: z.enum(["box", "unit"]),
  quantity: z.number().int().positive(),
  ownerType: z.enum(["warehouse", "technician"]).optional(),
  ownerId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  technicianId: z.string().trim().optional(),
  reasonCode: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * Inventory Scan Routes
 * نقطة موحدة لتنفيذ حركات المخزون عبر المسح (جهاز/جوال)
 */
export function registerInventoryScanRoutes(app: Express): void {
  app.post("/api/inventory-scan/execute", requireAuth, async (req, res) => {
    const actor = req.user!;

    try {
      const payload = executeInventoryScanSchema.parse(req.body);

      const result = await inventoryScanService.execute(payload, {
        id: actor.id,
        username: actor.username,
        role: actor.role,
        regionId: actor.regionId,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "بيانات المسح غير صحيحة",
          errors: error.errors,
        });
      }

      if (error instanceof InventoryScanError) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      console.error("Inventory scan execution error:", error);
      res.status(500).json({
        message: "فشل تنفيذ عملية المسح",
      });
    }
  });
}

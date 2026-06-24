import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryEntriesContainer } from "@server/composition/inventory-entries.container";

/**
 * Warehouse Inventory Entries Routes - مدخلات مخزون المستودعات (< 100 lines)
 * مجال المسؤولية: إدارة قيود المخزون في المستودعات
 */
export function registerWarehouseInventoryEntriesRoutes(app: Express): void {

  // عرض قيود مخزون المستودع
  app.get("/api/warehouses/:warehouseId/inventory-entries", requireAuth, async (req, res) => {
    try {
      const entries = await inventoryEntriesContainer.inventoryEntriesUseCase.getWarehouseEntries(req.params.warehouseId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching warehouse inventory entries:", error);
      res.status(500).json({ message: "Failed to fetch inventory entries" });
    }
  });

  // إنشاء أو تحديث قيد مخزون في المستودع
  app.post("/api/warehouses/:warehouseId/inventory-entries", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        itemTypeId: z.string(),
        boxes: z.number().min(0),
        units: z.number().min(0)
      });

      const data = schema.parse(req.body);
      const entry = await inventoryEntriesContainer.inventoryEntriesUseCase.upsertWarehouseEntry(req.params.warehouseId, {
        itemTypeId: data.itemTypeId,
        boxes: data.boxes,
        units: data.units,
      });
      
      res.json(entry);
    } catch (error) {
      console.error("Error upserting warehouse inventory entry:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update inventory entry" });
    }
  });
}
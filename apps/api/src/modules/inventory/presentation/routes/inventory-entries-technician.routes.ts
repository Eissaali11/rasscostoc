import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryEntriesContainer } from "@server/composition/inventory-entries.container";

/**
 * Technician Inventory Entries Routes - مدخلات مخزون المندوبين (< 100 lines)
 * مجال المسؤولية: إدارة قيود المخزون الثابت والمتنقل للمندوبين
 */
export function registerTechnicianInventoryEntriesRoutes(app: Express): void {

  // عرض قيود المخزون الثابت للمندوب
  app.get("/api/technicians/:technicianId/fixed-inventory-entries", requireAuth, async (req, res) => {
    try {
      const entries = await inventoryEntriesContainer.inventoryEntriesUseCase.getTechnicianFixedEntries(req.params.technicianId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching technician fixed inventory entries:", error);
      res.status(500).json({ message: "Failed to fetch inventory entries" });
    }
  });

  // إنشاء أو تحديث قيد مخزون ثابت للمندوب
  app.post("/api/technicians/:technicianId/fixed-inventory-entries", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        itemTypeId: z.string(),
        boxes: z.number().min(0),
        units: z.number().min(0)
      });
      const data = schema.parse(req.body);
      const entry = await inventoryEntriesContainer.inventoryEntriesUseCase.upsertTechnicianFixedEntry(req.params.technicianId, {
        itemTypeId: data.itemTypeId,
        boxes: data.boxes,
        units: data.units,
      });
      res.json(entry);
    } catch (error) {
      console.error("Error upserting technician fixed inventory entry:", error);
      res.status(500).json({ message: "Failed to update inventory entry" });
    }
  });

  // عرض قيود المخزون المتنقل للمندوب
  app.get("/api/technicians/:technicianId/moving-inventory-entries", requireAuth, async (req, res) => {
    try {
      const entries = await inventoryEntriesContainer.inventoryEntriesUseCase.getTechnicianMovingEntries(req.params.technicianId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching technician moving inventory entries:", error);
      res.status(500).json({ message: "Failed to fetch inventory entries" });
    }
  });

  // إنشاء أو تحديث قيد مخزون متنقل للمندوب (يدعم التحديث المجمع)
  app.post("/api/technicians/:technicianId/moving-inventory-entries", requireAuth, async (req, res) => {
    try {
      const { entries } = req.body;
      
      // Support both single entry and array of entries
      if (entries && Array.isArray(entries)) {
        // Batch update multiple entries
        const results = await inventoryEntriesContainer.inventoryEntriesUseCase.upsertTechnicianMovingEntriesBatch(
          req.params.technicianId,
          entries.map((entry: any) => ({
            itemTypeId: entry.itemTypeId,
            boxes: entry.boxes || 0,
            units: entry.units || 0,
          })),
        );
        res.json(results);
      } else {
        // Single entry (backward compatible)
        const schema = z.object({
          itemTypeId: z.string(),
          boxes: z.number().min(0),
          units: z.number().min(0)
        });
        const data = schema.parse(req.body);
        const entry = await inventoryEntriesContainer.inventoryEntriesUseCase.upsertTechnicianMovingEntry(req.params.technicianId, {
          itemTypeId: data.itemTypeId,
          boxes: data.boxes,
          units: data.units,
        });
        res.json(entry);
      }
    } catch (error) {
      console.error("Error upserting technician moving inventory entry:", error);
      res.status(500).json({ message: "Failed to update inventory entry" });
    }
  });
}

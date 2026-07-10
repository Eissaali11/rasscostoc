import type { Express } from "express";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryEntriesMigrationContainer } from "@server/composition/inventory-entries-migration.container";

/**
 * Inventory Entries Migration Routes - هجرة قيود المخزون (< 100 lines)
 * مجال المسؤولية: أدوات الهجرة والانتقال لقيود المخزون
 */
export function registerInventoryEntriesMigrationRoutes(app: Express): void {

  // هجرة قيود المخزون إلى البنية الجديدة
  app.post("/api/migrate-inventory-entries", requireAuth, async (req, res) => {
    try {
      await inventoryEntriesMigrationContainer.inventoryEntriesMigrationUseCase.execute();
      res.json({ success: true, message: "Migration completed successfully" });
    } catch (error) {
      console.error("Error migrating inventory entries:", error);
      res.status(500).json({ message: "Migration failed" });
    }
  });
}
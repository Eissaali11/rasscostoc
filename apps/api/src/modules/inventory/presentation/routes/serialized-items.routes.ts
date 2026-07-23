import type { Express } from "express";
import { serializedItemsContainer } from "@server/composition/serialized-items.container";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { serializedItemsService } from "@modules/inventory/infrastructure/services/serialized-items.service";

/**
 * Serialized Items Routing Configuration
 */
export function registerSerializedItemsRoutes(app: Express): void {
  const controller = serializedItemsContainer.serializedItemsController;

  // Get active serialized custody for a technician
  app.get(
    "/api/technicians/:technicianId/serialized-custody",
    requireAuth,
    controller.getTechnicianCustody
  );

  // Get MY serialized custody (authenticated user shortcut)
  app.get(
    "/api/my-serialized-custody",
    requireAuth,
    controller.getMySerializedCustody
  );

  // Add item to custody
  app.post(
    "/api/serialized-items/scan-in",
    requireAuth,
    controller.scanIn
  );

  // Batch add items to custody
  app.post(
    "/api/serialized-items/batch-scan-in",
    requireAuth,
    controller.batchScanIn
  );

  // Deliver item from custody
  app.post(
    "/api/serialized-items/scan-out",
    requireAuth,
    controller.scanOut
  );

  // Lookup item custody and lifecycle history
  app.get(
    "/api/serialized-items/lookup/:serialNumber",
    requireAuth,
    controller.lookup
  );

  // Update serial number or fields of an item
  app.patch(
    "/api/serialized-items/:id",
    requireAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { serialNumber } = req.body;
        if (!serialNumber || typeof serialNumber !== "string") {
          return res.status(400).json({ message: "الرقم التسلسلي مطلوب" });
        }
        const updated = await serializedItemsService.updateSerial(id, serialNumber);
        if (!updated) {
          return res.status(404).json({ message: "الجهاز غير موجود" });
        }
        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ message: err.message || "فشل تحديث السيريال" });
      }
    }
  );

  // Delete item from custody
  app.delete(
    "/api/serialized-items/:id",
    requireAuth,
    async (req, res) => {
      try {
        const { id } = req.params;
        const deleted = await serializedItemsService.deleteItem(id);
        if (!deleted) {
          return res.status(404).json({ message: "الجهاز غير موجود" });
        }
        res.json({ message: "تم حذف الجهاز من العهدة بنجاح" });
      } catch (err: any) {
        res.status(500).json({ message: err.message || "فشل حذف الجهاز" });
      }
    }
  );
}



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
        const user = req.user!;
        const payload = typeof req.body === "object" && req.body !== null ? req.body : { serialNumber: String(req.body) };
        const updated = await serializedItemsService.updateSerial(id, payload);
        if (!updated) {
          return res.status(404).json({ message: "الجهاز غير موجود" });
        }

        // Audit Log
        try {
          const { db } = await import("@core/config/db");
          const { systemLogs } = await import("@shared/schema");
          await db.insert(systemLogs).values({
            userId: user.id,
            userName: user.fullName || user.username,
            userRole: user.role,
            action: "update",
            entityType: "item",
            entityId: id,
            entityName: payload.serialNumber || updated.serialNumber || id,
            description: `تم تعديل وتحديث بيانات الأصل/السيريال (${payload.serialNumber || updated.serialNumber || id})`,
            details: JSON.stringify({
              itemId: id,
              changes: payload,
              updatedBy: user.fullName || user.username,
              ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
            }),
            severity: "info",
            success: true,
          });
        } catch (lErr) {
          console.error("Log error:", lErr);
        }

        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ message: err.message || "فشل تحديث البيانات" });
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
        const user = req.user!;
        
        let serialNum = id;
        try {
          const { db } = await import("@core/config/db");
          const { items } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          const found = await db.query.items.findFirst({ where: eq(items.id, id) });
          if (found?.serialNumber) serialNum = found.serialNumber;
        } catch (_) {}

        const deleted = await serializedItemsService.deleteItem(id);
        if (!deleted) {
          return res.status(404).json({ message: "الجهاز غير موجود" });
        }

        // Audit Log
        try {
          const { db } = await import("@core/config/db");
          const { systemLogs } = await import("@shared/schema");
          await db.insert(systemLogs).values({
            userId: user.id,
            userName: user.fullName || user.username,
            userRole: user.role,
            action: "delete",
            entityType: "item",
            entityId: id,
            entityName: serialNum,
            description: `تم حذف الأصل/المادة برقم تسلسلي (${serialNum}) نهائياً من النظام`,
            details: JSON.stringify({
              itemId: id,
              serialNumber: serialNum,
              deletedBy: user.fullName || user.username,
              deletedAt: new Date().toISOString(),
              ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
            }),
            severity: "error",
            success: true,
          });
        } catch (lErr) {
          console.error("Log delete error:", lErr);
        }

        res.json({ message: "تم حذف الجهاز من العهدة بنجاح" });
      } catch (err: any) {
        res.status(500).json({ message: err.message || "فشل حذف الجهاز" });
      }
    }
  );

  // TEMPORARY FEATURE — remove or disable after final customer handover.
  // Permanently delete a DEVICE or SIM from the authenticated technician's own active
  // custody. itemType is an explicit URL segment ("DEVICE"|"SIM") so the two can never
  // be confused. Gated by ENABLE_TECHNICIAN_CUSTODY_DELETE (see technician-custody-delete.flag.ts).
  // NOTE: distinct from the unguarded admin-style PATCH/DELETE ":id" routes above —
  // this one enforces custody ownership, a typed itemType, confirmation, and a feature flag.
  app.delete(
    "/api/serialized-items/my-custody/:itemType/:serialNumber",
    requireAuth,
    controller.deleteFromMyCustody
  );
}



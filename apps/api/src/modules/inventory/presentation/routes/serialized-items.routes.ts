import type { Express } from "express";
import { serializedItemsContainer } from "@server/composition/serialized-items.container";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { db } from "@core/config/db";
import { items, itemTypes } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Serialized Items Routing Configuration
 */
export function registerSerializedItemsRoutes(app: Express): void {
  const controller = serializedItemsContainer.serializedItemsController;

  // Get active serialized custody for a technician
  app.get(
    "/api/technicians/:technicianId/serialized-custody",
    requireAuth,
    async (req, res) => {
      try {
        const { technicianId } = req.params;
        const custodyItems = await db
          .select({
            id: items.id,
            serialNumber: items.serialNumber,
            status: items.status,
            carrierName: items.carrierName,
            createdAt: items.createdAt,
            itemTypeNameAr: itemTypes.nameAr,
            itemTypeNameEn: itemTypes.nameEn,
            itemTypeId: items.itemTypeId,
          })
          .from(items)
          .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
          .where(
            and(
              eq(items.currentOwnerId, technicianId),
              inArray(items.status, ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN"])
            )
          );
        res.json(custodyItems);
      } catch (err: any) {
        res.status(500).json({ message: err.message || "Failed to fetch custody items" });
      }
    }
  );

  // Get MY serialized custody (authenticated user shortcut)
  app.get(
    "/api/my-serialized-custody",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const custodyItems = await db
          .select({
            id: items.id,
            serialNumber: items.serialNumber,
            status: items.status,
            carrierName: items.carrierName,
            createdAt: items.createdAt,
            itemTypeNameAr: itemTypes.nameAr,
            itemTypeNameEn: itemTypes.nameEn,
            itemTypeId: items.itemTypeId,
          })
          .from(items)
          .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
          .where(
            and(
              eq(items.currentOwnerId, userId),
              inArray(items.status, ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN"])
            )
          );
        res.json(custodyItems);
      } catch (err: any) {
        res.status(500).json({ message: err.message || "Failed to fetch custody items" });
      }
    }
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
}

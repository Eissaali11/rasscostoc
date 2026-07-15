import type { Express } from "express";
import { serializedItemsContainer } from "@server/composition/serialized-items.container";
import { requireAuth } from "@core/middlewares/auth.middleware";

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
}

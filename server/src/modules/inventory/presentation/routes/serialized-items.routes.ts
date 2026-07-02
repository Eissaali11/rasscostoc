import type { Express } from "express";
import { serializedItemsController } from "../controllers/serialized-items.controller";
import { requireAuth } from "@core/middlewares/auth.middleware";

/**
 * Serialized Items Routing Configuration
 */
export function registerSerializedItemsRoutes(app: Express): void {
  // Add item to custody
  app.post(
    "/api/serialized-items/scan-in",
    requireAuth,
    serializedItemsController.scanIn
  );

  // Deliver item from custody
  app.post(
    "/api/serialized-items/scan-out",
    requireAuth,
    serializedItemsController.scanOut
  );

  // Lookup item custody and lifecycle history
  app.get(
    "/api/serialized-items/lookup/:serialNumber",
    requireAuth,
    serializedItemsController.lookup
  );
}

/**
 * Events Bootstrap
 *
 * Registers all platform event subscribers on startup.
 */

import { InventorySubscriber } from "../../modules/inventory/infrastructure/subscribers/inventory.subscriber";
import { CourierAuditSubscriber } from "../../modules/courier/infrastructure/subscribers/courier-audit.subscriber";
import { CourierSagaSubscriber } from "../../modules/courier/infrastructure/subscribers/courier-saga.subscriber";

export function initializeEventSubscribers(): void {
  console.log("⏳ Initializing Platform Event Subscribers...");

  InventorySubscriber.register();
  CourierAuditSubscriber.register();
  CourierSagaSubscriber.register();

  console.log("✅ All Event Subscribers Registered Successfully!");
}

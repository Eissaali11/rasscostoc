import { InventorySubscriber } from "@modules/courier/infrastructure/subscribers/inventory-deduction.subscriber";
import { CourierAuditSubscriber } from "@modules/courier/infrastructure/subscribers/courier-audit.subscriber";
import { CourierSagaSubscriber } from "@modules/courier/infrastructure/subscribers/courier-saga.subscriber";

export function initializeEventSubscribers(): void {
  console.log("⏳ [Composition Root] Initializing Platform Event Subscribers...");

  InventorySubscriber.register();
  CourierAuditSubscriber.register();
  CourierSagaSubscriber.register();

  console.log("✅ [Composition Root] All Event Subscribers Registered Successfully!");
}

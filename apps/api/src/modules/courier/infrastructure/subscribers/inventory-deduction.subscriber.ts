/**
 * InventorySubscriber
 *
 * Listens to ExecutionCompletedEvent to perform physical inventory deductions.
 * If the deduction fails, publishes an InventoryDeductionFailedEvent.
 *
 * Relocated from modules/inventory/infrastructure/subscribers/ (ERP-005A-4 Phase 2,
 * cycle C1): despite its former location, this class subscribes to a courier event,
 * reads courier's own courier_request_items table, and drives courier's own
 * InventoryEngine (via createInventoryEngine) — it is a courier-side reaction
 * handler, not an inventory-owned component. Its old location was the root cause
 * of the inventory<->courier circular dependency: inventory/contracts re-exported
 * it, which made inventory/contracts depend on courier/contracts (for
 * createInventoryEngine), which depends on courier's composition root, which
 * depends on SerializedItemsAdapter, which depends back on inventory/contracts.
 */

import { EventBus } from "@core/events/event-bus";
import { ExecutionCompletedEvent, InventoryDeductionFailedEvent } from "@core/events/events";
import { createInventoryEngine } from "../../composition/courier.container";
import { idempotencyService } from "@core/idempotency/idempotency.service";
import { tracer } from "@core/telemetry/tracer";
import { db } from "@core/config/db";
import { courierRequestItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { CourierInventoryPortAdapter } from "@server/composition/courier-inventory.adapter";
import { DrizzleCourierRepository } from "../repositories/drizzle-courier.repository";
import { logger } from "@core/telemetry/logger";

const MODULE = "InventorySubscriber";

export class InventorySubscriber {
  /**
   * Initialize and register the subscriber to listen to ExecutionCompletedEvent.
   */
  public static register(): void {
    const eventBus = EventBus.getInstance();

    eventBus.subscribe(
      "ExecutionCompletedEvent",
      async (event: any) => {
        const { requestId, actorId, execution, request } = event.payload;

        logger.info({
          message: `Received ExecutionCompletedEvent for request ID: ${requestId}`,
          module: MODULE,
          action: "receivedEvent",
          metadata: { requestId, actorId },
        });

        const inventoryPort = new CourierInventoryPortAdapter(new DrizzleCourierRepository());

        // Build serial list first so deduction can resolve technician from custody owner
        const devices: { serialNumber: string; model?: string }[] = [];
        const serialsForCustody: string[] = [];

        const addSerial = async (sn?: string | null) => {
          if (!sn?.trim()) return;
          const candidates = await inventoryPort.buildStoredSerialCandidates(sn);
          const serial =
            [...candidates].sort((a, b) => a.length - b.length)[0] || sn.trim();
          if (!devices.some((d) => d.serialNumber === serial)) {
            devices.push({ serialNumber: serial, model: request.vendorType ?? undefined });
          }
          if (!serialsForCustody.includes(serial)) {
            serialsForCustody.push(serial);
          }
          for (const c of candidates) {
            if (!serialsForCustody.includes(c)) serialsForCustody.push(c);
          }
        };

        const looksLikeSerial = (s?: string | null) => {
          if (!s?.trim()) return false;
          const t = s.trim();
          return t.length >= 6 && !t.startsWith("{") && !t.startsWith("[");
        };

        await addSerial(execution.sn);
        if (looksLikeSerial(execution.extraField1)) await addSerial(execution.extraField1);
        if (looksLikeSerial(execution.extraField2)) await addSerial(execution.extraField2);
        if (looksLikeSerial(execution.simSerial)) await addSerial(execution.simSerial);

        const requestItemsList = await db
          .select()
          .from(courierRequestItems)
          .where(eq(courierRequestItems.requestId, requestId));

        for (const item of requestItemsList) {
          if (item.status === "RECEIVED" || item.status === "DELIVERED" || item.status === "INSTALLED") {
            if (item.itemType === "POS" && item.serialNumber) {
              await addSerial(item.serialNumber);
            } else if (item.itemType === "SIM" && item.simSerial) {
              await addSerial(item.simSerial);
            }
          }
        }

        // Prefer username stamped from custody owner; fall back to assignment only if needed
        let technicianCode =
          execution.technicianCode || execution.salesTechnician || request.tecName || "unknown";

        const idempotencyKey = `${event.name}:REQ-${requestId}:InventorySubscriber:v${event.version}`;

        await idempotencyService.execute(
          idempotencyKey,
          event.id,
          "InventorySubscriber",
          async () => {
            const span = tracer.startSpan("InventoryDeduction", { requestId, actorId, technicianCode });

            try {
              const engine = createInventoryEngine();
              const deductionResult = await engine.deduct({
                requestId,
                actorId,
                technicianCode,
                devices,
                serialsForCustody,
                customerName: request.customerName ?? "عميل غير معروف",
                referenceNumber: request.incidentNumber ?? String(requestId),
                vendorType: request.vendorType,
                notes: `خصم تلقائي — مطابقة تقرير التسليم — طلب رقم: ${requestId}`,
              });

              // If there were any errors, publish deduction failed event
              if (deductionResult.errors.length > 0) {
                logger.error({
                  message: "Deduction completed with errors",
                  module: MODULE,
                  action: "deduct",
                  metadata: { requestId, errors: deductionResult.errors },
                });

                await eventBus.publish(
                  new InventoryDeductionFailedEvent({
                    requestId,
                    actorId,
                    technicianCode,
                    errors: deductionResult.errors,
                  })
                );
                return { success: false, errors: deductionResult.errors };
              } else {
                logger.info({
                  message: `Inventory successfully deducted for request ${requestId}`,
                  module: MODULE,
                  action: "deduct",
                  metadata: { requestId },
                });
                return { success: true };
              }
            } catch (err: any) {
              logger.error({
                message: "Critical error during inventory deduction",
                module: MODULE,
                action: "deduct",
                metadata: { requestId, technicianCode },
                error: err,
              });

              await eventBus.publish(
                new InventoryDeductionFailedEvent({
                  requestId,
                  actorId,
                  technicianCode,
                  errors: [err.message || "Critical deduction engine error"],
                })
              );
              throw err;
            } finally {
              span.end();
            }
          }
        );
      }
    );
  }
}

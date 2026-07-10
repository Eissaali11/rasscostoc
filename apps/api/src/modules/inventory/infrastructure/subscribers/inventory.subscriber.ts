/**
 * InventorySubscriber
 *
 * Listens to ExecutionCompletedEvent to perform physical inventory deductions.
 * If the deduction fails, publishes an InventoryDeductionFailedEvent.
 */

import { EventBus } from "@core/events/event-bus";
import { ExecutionCompletedEvent, InventoryDeductionFailedEvent } from "@core/events/events";
import { InventoryEngine } from "../../../courier/application/inventory/inventory.engine";
import { idempotencyService } from "@core/idempotency/idempotency.service";
import { tracer } from "@core/telemetry/tracer";
import { db } from "@core/config/db";
import { courierRequestItems } from "@shared/schema";
import { eq } from "drizzle-orm";

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

        console.log(
          `[InventorySubscriber] Received ExecutionCompletedEvent for request ID: ${requestId}`
        );

        const technicianCode =
          execution.technicianCode || execution.salesTechnician || request.tecName;

        if (!technicianCode) {
          console.error(
            `[InventorySubscriber] Deduction aborted: No technician code found for request ${requestId}`
          );
          return;
        }

        const idempotencyKey = `${event.name}:REQ-${requestId}:InventorySubscriber:v${event.version}`;

        await idempotencyService.execute(
          idempotencyKey,
          event.id,
          "InventorySubscriber",
          async () => {
            // Build serial list (exactly matching the former logic)
            const devices: { serialNumber: string; model?: string }[] = [];
            const serialsForCustody: string[] = [];

            const addSerial = (sn?: string | null) => {
              if (!sn?.trim()) return;
              const serial = sn.trim();
              devices.push({ serialNumber: serial, model: request.vendorType ?? undefined });
              serialsForCustody.push(serial);
            };

            addSerial(execution.sn);
            addSerial(execution.extraField1);
            addSerial(execution.extraField2);
            if (execution.simSerial?.trim()) {
              const simSerialTrimmed = execution.simSerial.trim();
              if (!serialsForCustody.includes(simSerialTrimmed)) {
                serialsForCustody.push(simSerialTrimmed);
              }
            }

            // Fetch scanned serial numbers bound to the courier request items (V14 flow)
            const requestItemsList = await db
              .select()
              .from(courierRequestItems)
              .where(eq(courierRequestItems.requestId, requestId));

            for (const item of requestItemsList) {
              if (item.status === "RECEIVED" || item.status === "DELIVERED") {
                if (item.itemType === "POS" && item.serialNumber) {
                  addSerial(item.serialNumber);
                } else if (item.itemType === "SIM" && item.simSerial) {
                  const serialTrimmed = item.simSerial.trim();
                  if (!serialsForCustody.includes(serialTrimmed)) {
                    serialsForCustody.push(serialTrimmed);
                  }
                }
              }
            }

            const span = tracer.startSpan("InventoryDeduction", { requestId, actorId, technicianCode });

            try {
              const engine = InventoryEngine.createDefault();
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
                console.error(
                  `[InventorySubscriber] Deduction completed with errors:`,
                  deductionResult.errors
                );
                
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
                console.log(
                  `[InventorySubscriber] Inventory successfully deducted for request ${requestId}.`
                );
                return { success: true };
              }
            } catch (err: any) {
              console.error(
                `[InventorySubscriber] Critical error during inventory deduction:`,
                err
              );

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

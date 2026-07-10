/**
 * CourierAuditSubscriber
 *
 * Listens to Courier-related events to write decoupled audit logs.
 */

import { EventBus } from "@core/events/event-bus";
import { ExecutionSavedEvent, InventoryDeductionFailedEvent } from "@core/events/events";
import { db } from "@server/core/config/db";
import { courierAuditLogs } from "@shared/schema";
import { idempotencyService } from "@core/idempotency/idempotency.service";

export class CourierAuditSubscriber {
  /**
   * Register all event listeners for auditing.
   */
  public static register(): void {
    const eventBus = EventBus.getInstance();

    // 1. Audit execution save
    eventBus.subscribe(
      "ExecutionSavedEvent",
      async (event: any) => {
        const { requestId, actorId, execution } = event.payload;
        const idempotencyKey = `${event.name}:REQ-${requestId}:CourierAuditSubscriber:v${event.version}`;

        await idempotencyService.execute(
          idempotencyKey,
          event.id,
          "CourierAuditSubscriber",
          async () => {
            console.log(
              `[CourierAuditSubscriber] Audit: Execution saved for request ${requestId} by ${actorId}. Status: ${execution.installationStatus}`
            );
            return { success: true };
          }
        );
      }
    );

    // 2. Audit inventory deduction failure
    eventBus.subscribe(
      "InventoryDeductionFailedEvent",
      async (event: any) => {
        const { requestId, actorId, technicianCode, errors } = event.payload;
        const idempotencyKey = `${event.name}:REQ-${requestId}:CourierAuditSubscriber:v${event.version}`;

        await idempotencyService.execute(
          idempotencyKey,
          event.id,
          "CourierAuditSubscriber",
          async () => {
            console.error(
              `[CourierAuditSubscriber] Audit: Inventory deduction failed for request ${requestId}. Errors:`,
              errors
            );

            try {
              await db.insert(courierAuditLogs).values({
                tableName: "executions",
                recordId: requestId,
                fieldName: "inventory_status",
                oldValue: "PENDING_DEDUCTION",
                newValue: `فشل خصم المخزون للفني ${technicianCode}: ${errors.join("; ")}`,
                action: "deduction_failed",
                changedBy: actorId,
                changedAt: new Date(),
              });
              console.log(`[CourierAuditSubscriber] Recorded deduction failure in audit logs.`);
              return { success: true };
            } catch (dbErr) {
              console.error(
                `[CourierAuditSubscriber] Failed to record audit log for deduction failure:`,
                dbErr
              );
              throw dbErr;
            }
          }
        );
      }
    );
  }
}

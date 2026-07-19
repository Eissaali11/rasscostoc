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
import { logger } from "@core/telemetry/logger";

const MODULE = "CourierAuditSubscriber";

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
            logger.info({
              message: "Audit: Execution saved",
              module: MODULE,
              action: "executionSaved",
              metadata: { requestId, actorId, status: execution.installationStatus },
            });
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
            logger.error({
              message: "Audit: Inventory deduction failed",
              module: MODULE,
              action: "deductionFailed",
              metadata: { requestId, actorId, technicianCode, errors },
            });

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
              logger.info({ message: "Recorded deduction failure in audit logs", module: MODULE, action: "auditWrite", metadata: { requestId } });
              return { success: true };
            } catch (dbErr) {
              logger.error({ message: "Failed to record audit log for deduction failure", module: MODULE, action: "auditWrite", metadata: { requestId }, error: dbErr });
              throw dbErr;
            }
          }
        );
      }
    );
  }
}

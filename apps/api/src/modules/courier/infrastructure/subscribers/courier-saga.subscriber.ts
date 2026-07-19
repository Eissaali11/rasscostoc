/**
 * CourierSagaSubscriber
 *
 * Listens to InventoryDeductionFailedEvent to run compensating transactions (Sagas)
 * when asynchronous inventory deduction fails. Reverts execution status to ensure eventual consistency.
 */

import { EventBus } from "@core/events/event-bus";
import { db } from "@server/core/config/db";
import { drizzleCourierRepository } from "../repositories/drizzle-courier.repository";
import { idempotencyService } from "@core/idempotency/idempotency.service";
import { metrics } from "@core/telemetry/metrics";
import { logger } from "@core/telemetry/logger";

const MODULE = "CourierSagaSubscriber";

export class CourierSagaSubscriber {
  /**
   * Register the subscriber for saga compensating events.
   */
  public static register(): void {
    const eventBus = EventBus.getInstance();

    eventBus.subscribe(
      "InventoryDeductionFailedEvent",
      async (event: any) => {
        const { requestId, actorId, errors } = event.payload;
        const idempotencyKey = `${event.name}:REQ-${requestId}:CourierSagaSubscriber:v${event.version}`;

        await idempotencyService.execute(
          idempotencyKey,
          event.id,
          "CourierSagaSubscriber",
          async () => {
            logger.warn({
              message: `Compensating transaction triggered for request ${requestId}. Reverting status to In Progress`,
              module: MODULE,
              action: "compensate",
              metadata: { requestId, actorId, errors },
            });

            try {
              await db.transaction(async (tx) => {
                // Fetch the current installationStatus before reverting
                const curr = await drizzleCourierRepository.findExecutionByRequestId(requestId, tx);

                const oldStatus = curr?.installationStatus || "Installation Completed";

                // Revert status to In Progress and set pushBack with the deduction errors
                const updated = await drizzleCourierRepository.updateExecution(requestId, {
                  installationStatus: "In Progress",
                  pushBack: `فشل خصم العهدة تلقائياً: ${errors.join("; ")}`,
                }, undefined, tx);

                if (updated) {
                  // Log audit for saga compensation
                  await drizzleCourierRepository.insertAuditLog({
                    tableName: "executions",
                    recordId: requestId,
                    fieldName: "installation_status",
                    oldValue: oldStatus,
                    newValue: "In Progress (Reverted due to inventory failure)",
                    action: "saga_compensate",
                    changedBy: actorId,
                  }, tx);

                  metrics.incrementCounter("saga_compensations_total");
                  logger.info({
                    message: `Eventual consistency restored: Request ${requestId} reverted to In Progress`,
                    module: MODULE,
                    action: "compensate",
                    metadata: { requestId },
                  });
                } else {
                  logger.warn({
                    message: `No execution record found to revert for request ${requestId}`,
                    module: MODULE,
                    action: "compensate",
                    metadata: { requestId },
                  });
                }
              });

              return { success: true };
            } catch (sagaErr) {
              logger.error({
                message: `Critical error while executing compensating transaction for request ${requestId}`,
                module: MODULE,
                action: "compensate",
                metadata: { requestId },
                error: sagaErr,
              });
              throw sagaErr;
            }
          }
        );
      }
    );
  }
}

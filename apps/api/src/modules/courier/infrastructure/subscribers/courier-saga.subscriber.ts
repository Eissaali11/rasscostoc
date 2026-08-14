/**
 * CourierSagaSubscriber
 *
 * Listens to InventoryDeductionFailedEvent to run compensating transactions (Sagas)
 * when asynchronous inventory deduction fails. Reverts execution status to ensure eventual consistency.
 */

import { EventBus } from "@core/events/event-bus";
import { db } from "@server/core/config/db";
import { eq } from "drizzle-orm";
import { drizzleCourierRepository } from "../repositories/drizzle-courier.repository";
import { idempotencyService } from "@core/idempotency/idempotency.service";
import { metrics } from "@core/telemetry/metrics";
import { courierExecutionAuditDedup, courierAuditLogs, inventoryDeductionCompletions } from "@shared/schema";

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
            console.warn(
              `[CourierSagaSubscriber] Compensating transaction triggered for request ${requestId}. Reverting status to In Progress...`
            );

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
                  console.log(
                    `[CourierSagaSubscriber] Eventual consistency restored: Request ${requestId} reverted to In Progress.`
                  );
                } else {
                  console.warn(
                    `[CourierSagaSubscriber] No execution record found to revert for request ${requestId}.`
                  );
                }
              });

              // OPS-REMED-E4-P2: only a `final: true` (DEAD-letter, terminal)
              // delivery drives the custody_closure_status final transition
              // — everything above this block runs unchanged for EVERY
              // delivery (attempt or final), exactly as before P2.
              if (event.payload?.final === true) {
                await courierSagaFinalFailureTransition(event.payload);
              }

              return { success: true };
            } catch (sagaErr) {
              console.error(
                `[CourierSagaSubscriber] Critical error while executing compensating transaction for request ${requestId}:`,
                sagaErr
              );
              throw sagaErr;
            }
          }
        );
      }
    );
  }
}

/**
 * OPS-REMED-E4-P2 — Design A (A.6 §8): the single, atomic
 * dedup + evidence-check + guarded-CAS + mandatory-audit sequence, all in
 * one database transaction. Sole owner of the FAILED_FINAL and the
 * defense-in-depth correctable FAILED_FINAL -> CLOSED_SUCCESS transition.
 * Not exported outside this file — CourierSagaSubscriber's registered
 * handler is the only real caller (CourierProjectionWorker owns the
 * independent, uncapped success-convergence path separately, A.9 §5-§7,
 * using the same underlying evidence table but its own transition call).
 */
async function courierSagaFinalFailureTransition(payload: {
  requestId: number;
  sourceEventId: string;
}): Promise<void> {
  const { requestId, sourceEventId } = payload;

  await db.transaction(async (tx) => {
    // 1) Dedup insert, keyed by (source_event_id, operation_kind) — NOT
    // source_event_id alone, so this FINAL_FAILURE record can never
    // collide with a later, independent SUCCESS_PROJECTION correction for
    // the SAME original event (A.9 §4 real gap, closed).
    try {
      await tx.insert(courierExecutionAuditDedup).values({
        sourceEventId,
        operationKind: "FINAL_FAILURE",
        eventName: "InventoryDeductionFailedEvent",
      });
    } catch (err: any) {
      if (err?.code === "23505") {
        // Already processed this exact final-failure delivery — no-op.
        return;
      }
      throw err;
    }

    // 2) Authoritative-evidence check (A.3 §6, A.7 §7): if the durable
    // completion row exists, the deduction actually succeeded — the
    // projection must converge to CLOSED_SUCCESS, never FAILED_FINAL,
    // regardless of why this DEAD/final-failure signal was also produced
    // (e.g. the case-C crash window: item commit succeeded, but the
    // subscriber's own idempotency-completion write never landed).
    const [completion] = await tx
      .select({ id: inventoryDeductionCompletions.id })
      .from(inventoryDeductionCompletions)
      .where(eq(inventoryDeductionCompletions.requestId, requestId))
      .limit(1);

    if (completion) {
      // 3a) Correctable transition: exact positive source set includes
      // both FAILED_RETRYABLE (normal path) and FAILED_FINAL (defensive —
      // corrects an already-terminal wrong state, A.9 §5-§6 correction).
      await drizzleCourierRepository.updateCustodyClosureStatus(
        requestId,
        ["FAILED_RETRYABLE", "FAILED_FINAL"],
        "CLOSED_SUCCESS",
        tx
      );
    } else {
      // 3b) Genuine terminal failure — exact positive source set.
      await drizzleCourierRepository.updateCustodyClosureStatus(
        requestId,
        ["FAILED_RETRYABLE"],
        "FAILED_FINAL",
        tx
      );
    }

    // 4) Mandatory audit write, same transaction.
    await tx.insert(courierAuditLogs).values({
      tableName: "executions",
      recordId: requestId,
      fieldName: "custody_closure_status",
      oldValue: "FAILED_RETRYABLE",
      newValue: completion ? "CLOSED_SUCCESS" : "FAILED_FINAL",
      action: completion ? "custody_closure_corrected" : "custody_closure_final_failure",
      changedBy: null,
    });
  });
}

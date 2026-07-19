/**
 * Outbox Worker — ERP-008 Phase 8-A
 * All log output now routes through the canonical structured logger.
 */
import { outboxRepository } from "./outbox.repository";
import { EventBus } from "../events/event-bus";
import { randomUUID } from "crypto";
import { logger } from "@core/telemetry/logger";
import { metrics } from "@core/telemetry/metrics";

const MODULE = "OutboxWorker";

export class OutboxWorker {
  private readonly workerId: string;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private currentRunPromise: Promise<void> | null = null;

  constructor(options?: { intervalMs?: number; batchSize?: number }) {
    this.workerId = `worker-${randomUUID()}`;
    this.intervalMs = options?.intervalMs || 5000; // default 5 seconds
    this.batchSize = options?.batchSize || 20;
  }

  /**
   * Starts the polling loop for outbox events.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ message: `Started Outbox Worker instance: ${this.workerId}`, module: MODULE, action: "start" });

    // Run immediately on startup, then trigger interval
    this.runOnce().catch(err =>
      logger.error({ message: "Error during initial run", module: MODULE, action: "start", error: err })
    );

    this.intervalId = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (err) {
        logger.error({ message: "Error during loop run", module: MODULE, action: "pollLoop", error: err });
      }
    }, this.intervalMs);
  }

  /**
   * Stops the polling loop.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info({ message: `Stopped Outbox Worker instance: ${this.workerId}`, module: MODULE, action: "stop" });
  }

  /**
   * Waits for the current batch execution to finish, up to the timeout.
   */
  async drain(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const checkIntervalMs = 50;

    return new Promise((resolve) => {
      const check = () => {
        if (!this.currentRunPromise) {
          logger.info({
            message: "OutboxWorker drained: active batch processing finished.",
            module: MODULE,
            action: "drain",
            metadata: { durationMs: Date.now() - startTime },
          });
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeoutMs) {
          logger.warn({
            message: "OutboxWorker drain timeout reached before batch finished.",
            module: MODULE,
            action: "drain",
            metadata: { timeoutMs },
          });
          resolve();
          return;
        }

        setTimeout(check, checkIntervalMs);
      };

      check();
    });
  }

  /**
   * Queries pending events, processes them via the event bus,
   * and updates their status (PUBLISHED, FAILED, or DEAD).
   */
  async runOnce(): Promise<void> {
    if (this.currentRunPromise) return this.currentRunPromise;
    this.currentRunPromise = this._executeRunOnce();
    try {
      await this.currentRunPromise;
    } finally {
      this.currentRunPromise = null;
    }
  }

  private async _executeRunOnce(): Promise<void> {
    const pendingEvents = await outboxRepository.getPendingEvents(this.batchSize, this.workerId);
    if (pendingEvents.length === 0) {
      return;
    }

    logger.info({
      message: `Processing ${pendingEvents.length} outbox event(s)`,
      module: MODULE,
      action: "processEvents",
      metadata: { workerId: this.workerId, count: pendingEvents.length },
    });

    const eventBus = EventBus.getInstance();

    for (const record of pendingEvents) {
      try {
        // Reconstruct event payload conforming to IEvent
        const eventInstance = {
          id: record.id,
          name: record.eventName,
          version: record.eventVersion,
          occurredAt: record.createdAt,
          timestamp: record.createdAt,
          correlationId: record.correlationId,
          causationId: record.causationId,
          payload: record.payload,
        };

        // Dispatch locally to EventBus subscribers
        await eventBus.publishLocal(eventInstance);

        // Success - mark as PUBLISHED
        await outboxRepository.markAsPublished(record.id);
        metrics.incrementCounter("outbox_events_published_total");
        logger.info({
          message: `Event published successfully`,
          module: MODULE,
          action: "publishEvent",
          metadata: { eventId: record.id, eventName: record.eventName },
        });
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        const nextRetryCount = record.retryCount + 1;

        logger.warn({
          message: `Event failed (Attempt ${nextRetryCount})`,
          module: MODULE,
          action: "eventFailed",
          metadata: { eventId: record.id, eventName: record.eventName, attempt: nextRetryCount },
          error: err,
        });

        metrics.incrementCounter("outbox_events_failed_total");

        if (nextRetryCount >= 3) {
          // Dead letter queue
          await outboxRepository.markAsDead(record.id, errorMsg);
          metrics.incrementCounter("outbox_events_dead_total");
          logger.error({
            message: `Event marked as DEAD (exceeded max retries)`,
            module: MODULE,
            action: "deadLetter",
            metadata: { eventId: record.id, eventName: record.eventName },
          });

          // Publish dead letter notifications to EventBus if critical
          try {
            if (record.eventName === "ExecutionCompletedEvent") {
              const payload = record.payload as any;
              const { InventoryDeductionFailedEvent } = await import("../events/events");
              await eventBus.publish(
                new InventoryDeductionFailedEvent({
                  requestId: payload.requestId,
                  actorId: payload.actorId,
                  technicianCode: payload.execution?.technicianCode || payload.execution?.salesTechnician || payload.request?.tecName || "unknown",
                  errors: [`Failed to process event after 3 retries: ${errorMsg}`],
                })
              );
            }
          } catch (dlqErr) {
            logger.error({
              message: "Failed to publish dead-letter notification",
              module: MODULE,
              action: "deadLetter",
              metadata: { eventId: record.id },
              error: dlqErr,
            });
          }
        } else {
          // Calculate interval backoff:
          // Attempt 1 -> retry after 5 sec
          // Attempt 2 -> retry after 30 sec
          // Attempt 3 -> retry after 120 sec (which will trigger DEAD status)
          let delayMs = 5000;
          if (nextRetryCount === 1) {
            delayMs = 30000;
          } else if (nextRetryCount === 2) {
            delayMs = 120000;
          }
          const nextRetryAt = new Date(Date.now() + delayMs);
          await outboxRepository.markAsFailed(record.id, errorMsg, nextRetryAt, record.retryCount);
        }
      }
    }
  }
}

export const outboxWorker = new OutboxWorker();

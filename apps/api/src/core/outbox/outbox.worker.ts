import { outboxRepository } from "./outbox.repository";
import { EventBus } from "../events/event-bus";
import { randomUUID } from "crypto";

export class OutboxWorker {
  private readonly workerId: string;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private inFlightRun: Promise<void> | null = null;

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
    console.info(`[OutboxWorker] Started Outbox Worker instance: ${this.workerId}`);
    
    // Run immediately on startup, then trigger interval
    this.inFlightRun = this.runOnce().catch(err => console.error("[OutboxWorker] Error during initial run:", err));

    this.intervalId = setInterval(() => {
      this.inFlightRun = this.runOnce().catch(err => {
        console.error("[OutboxWorker] Error during loop run:", err);
      });
    }, this.intervalMs);
  }

  /**
   * ERP-008 Phase 3: stops the polling loop immediately, then awaits
   * whichever runOnce() batch is currently in flight so a shutdown never
   * cuts off an event mid-publish.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.inFlightRun) {
      await this.inFlightRun;
    }
    console.info(`[OutboxWorker] Stopped Outbox Worker instance: ${this.workerId}`);
  }

  /**
   * Queries pending events, processes them via the event bus,
   * and updates their status (PUBLISHED, FAILED, or DEAD).
   */
  async runOnce(): Promise<void> {
    const pendingEvents = await outboxRepository.getPendingEvents(this.batchSize, this.workerId);
    if (pendingEvents.length === 0) {
      return;
    }

    console.log(`[OutboxWorker] Instance ${this.workerId} processing ${pendingEvents.length} outbox event(s).`);

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
        console.log(`[OutboxWorker] Event ${record.id} (${record.eventName}) published successfully.`);
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        const nextRetryCount = record.retryCount + 1;
        
        console.error(`[OutboxWorker] Event ${record.id} (${record.eventName}) failed (Attempt ${nextRetryCount}):`, errorMsg);

        if (nextRetryCount >= 3) {
          // Dead letter queue
          await outboxRepository.markAsDead(record.id, errorMsg);
          console.error(`[OutboxWorker] Event ${record.id} marked as DEAD (exceeded max retries).`);
          
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
            console.error("[OutboxWorker] Failed to publish dead-letter notification:", dlqErr);
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

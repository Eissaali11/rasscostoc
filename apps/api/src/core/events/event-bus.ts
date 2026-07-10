/**
 * EventBus — EventEmitter-based Pub/Sub Implementation
 *
 * Implements a decoupled, asynchronous event bus.
 * Supports transactional outbox pattern to guarantee event delivery.
 */

import { EventEmitter } from "events";
import type { IEvent, IEventBus, EventCallback } from "./event.types";
import { runWithContextAsync, type TelemetryContext } from "../telemetry/telemetry";
import { tracer } from "../telemetry/tracer";
import { metrics } from "../telemetry/metrics";

export class EventBus implements IEventBus {
  private static instance: EventBus;
  private readonly emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0); // Allow unlimited listeners for events
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event.
   * If in test mode or bypass mode, it routes immediately to local subscribers.
   * Otherwise, it enqueues to the PostgreSQL Outbox table within the optional transaction (tx).
   */
  async publish<TPayload>(event: IEvent<TPayload>, tx?: any): Promise<void> {
    if (process.env.BYPASS_OUTBOX === "true" || process.env.NODE_ENV === "test") {
      await this.publishLocal(event);
      return;
    }

    try {
      const { outboxRepository } = await import("../outbox/outbox.repository");
      await outboxRepository.enqueue(event, tx);
      console.log(`[EventBus] Enqueued event to Outbox table: ${event.name} (ID: ${event.id})`);
    } catch (err) {
      console.error(`[EventBus] Failed to enqueue event ${event.name} to Outbox:`, err);
      // Fallback to local dispatch in case database outbox save fails, to prevent blocking
      await this.publishLocal(event);
    }
  }

  /**
   * Directly invokes all local subscribers asynchronously.
   */
  async publishLocal<TPayload>(event: IEvent<TPayload>): Promise<void> {
    console.log(`[EventBus] Publishing event locally: ${event.name} at ${event.timestamp.toISOString()}`);
    
    return new Promise<void>((resolve, reject) => {
      setImmediate(async () => {
        const listeners = this.emitter.listeners(event.name) as EventCallback[];
        
        if (listeners.length === 0) {
          console.log(`[EventBus] No subscribers found for event: ${event.name}`);
          resolve();
          return;
        }

        // Execute all subscribers concurrently inside telemetry context
        const results = await Promise.allSettled(
          listeners.map(async (listener) => {
            const context: TelemetryContext = {
              correlationId: event.correlationId,
              traceId: event.correlationId,
              spanId: event.causationId,
            };

            return runWithContextAsync(context, async () => {
              const span = tracer.startSpan(`EventProcessing:${event.name}`);
              try {
                await listener(event);
              } catch (err: any) {
                metrics.incrementCounter("subscriber_failures_total");
                console.error(
                  `[EventBus] Error in subscriber for event "${event.name}":`,
                  err
                );
                throw err;
              } finally {
                span.end();
              }
            });
          })
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.error(
            `[EventBus] Event "${event.name}" finished with ${failures.length} subscriber failure(s).`
          );
          const firstReason = (failures[0] as PromiseRejectedResult).reason;
          reject(firstReason);
        } else {
          console.log(`[EventBus] Event "${event.name}" processed successfully by all subscribers.`);
          resolve();
        }
      });
    });
  }


  /**
   * Subscribe a callback to an event.
   */
  subscribe<TPayload>(eventName: string, callback: EventCallback<IEvent<TPayload>>): void {
    this.emitter.on(eventName, callback as any);
    console.log(`[EventBus] Subscriber registered for event: ${eventName}`);
  }

  /**
   * Unsubscribe a callback from an event.
   */
  unsubscribe<TPayload>(eventName: string, callback: EventCallback<IEvent<TPayload>>): void {
    this.emitter.off(eventName, callback as any);
    console.log(`[EventBus] Subscriber unregistered from event: ${eventName}`);
  }
}

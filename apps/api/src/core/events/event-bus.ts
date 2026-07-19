/**
 * EventBus — EventEmitter-based Pub/Sub Implementation — ERP-008 Phase 8-A
 *
 * Implements a decoupled, asynchronous event bus.
 * Supports transactional outbox pattern to guarantee event delivery.
 * All log output now routes through the canonical structured logger.
 */

import { EventEmitter } from "events";
import type { IEvent, IEventBus, EventCallback } from "./event.types";
import { runWithContextAsync, type TelemetryContext } from "../telemetry/telemetry";
import { tracer } from "../telemetry/tracer";
import { metrics } from "../telemetry/metrics";
import { logger } from "../telemetry/logger";

const MODULE = "EventBus";

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
      logger.info({
        message: `Enqueued event to Outbox table`,
        module: MODULE,
        action: "enqueue",
        metadata: { eventName: event.name, eventId: event.id },
      });
    } catch (err) {
      logger.error({
        message: `Failed to enqueue event to Outbox`,
        module: MODULE,
        action: "enqueue",
        metadata: { eventName: event.name, eventId: event.id },
        error: err,
      });
      // Fallback to local dispatch in case database outbox save fails, to prevent blocking
      await this.publishLocal(event);
    }
  }

  /**
   * Directly invokes all local subscribers asynchronously.
   */
  async publishLocal<TPayload>(event: IEvent<TPayload>): Promise<void> {
    logger.info({
      message: `Publishing event locally`,
      module: MODULE,
      action: "publishLocal",
      metadata: { eventName: event.name, eventId: event.id, occurredAt: event.timestamp.toISOString() },
    });

    return new Promise<void>((resolve, reject) => {
      setImmediate(async () => {
        const listeners = this.emitter.listeners(event.name) as EventCallback[];

        if (listeners.length === 0) {
          logger.warn({
            message: `No subscribers found for event`,
            module: MODULE,
            action: "publishLocal",
            metadata: { eventName: event.name },
          });
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
                logger.error({
                  message: `Error in subscriber for event`,
                  module: MODULE,
                  action: "subscriber",
                  metadata: { eventName: event.name },
                  error: err,
                });
                throw err;
              } finally {
                span.end();
              }
            });
          })
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          logger.error({
            message: `Event finished with subscriber failure(s)`,
            module: MODULE,
            action: "publishLocal",
            metadata: { eventName: event.name, failureCount: failures.length },
          });
          const firstReason = (failures[0] as PromiseRejectedResult).reason;
          reject(firstReason);
        } else {
          logger.info({
            message: `Event processed successfully by all subscribers`,
            module: MODULE,
            action: "publishLocal",
            metadata: { eventName: event.name, subscriberCount: listeners.length },
          });
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
    logger.info({ message: `Subscriber registered for event`, module: MODULE, action: "subscribe", metadata: { eventName } });
  }

  /**
   * Unsubscribe a callback from an event.
   */
  unsubscribe<TPayload>(eventName: string, callback: EventCallback<IEvent<TPayload>>): void {
    this.emitter.off(eventName, callback as any);
    logger.info({ message: `Subscriber unregistered from event`, module: MODULE, action: "unsubscribe", metadata: { eventName } });
  }
}

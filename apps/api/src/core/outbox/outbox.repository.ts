import { db } from "@core/config/db";
import { outboxEvents } from "@shared/schema";
import { eq, and, or, lte, inArray, isNull, sql } from "drizzle-orm";
import type { IEvent } from "../events/event.types";
import { metrics } from "../telemetry/metrics";

export class OutboxRepository {
  /**
   * Enqueues a domain event into the outbox table.
   * Can accept a transaction object (tx) to ensure atomicity with business operations.
   */
  async enqueue(event: IEvent, tx?: any): Promise<void> {
    const client = tx || db;
    await client.insert(outboxEvents).values({
      id: event.id,
      eventName: event.name,
      eventVersion: event.version,
      payload: event.payload,
      correlationId: event.correlationId,
      causationId: event.causationId,
      status: "PENDING",
      retryCount: 0,
      createdAt: event.occurredAt || new Date(),
    });
  }

  /**
   * Helper to query current outbox statistics for metrics/dashboard.
   */
  async getStats() {
    try {
      const [pendingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, "PENDING"));
      const [deadCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, "DEAD"));
      return {
        pending: Number(pendingCount?.count || 0),
        dead: Number(deadCount?.count || 0),
      };
    } catch {
      return { pending: 0, dead: 0 };
    }
  }

  async updateStatsGauges(): Promise<void> {
    const stats = await this.getStats();
    metrics.setGauge("outbox_pending_total", stats.pending);
    metrics.setGauge("outbox_dead_total", stats.dead);
  }

  /**
   * Retrieves pending or failed events that are eligible for processing,
   * and locks them for the current worker instance to prevent concurrent execution.
   */
  async getPendingEvents(limit: number, lockedBy: string): Promise<any[]> {
    const now = new Date();
    const expiryThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes lock expiry

    // Find all events that are:
    // (status = PENDING OR (status = FAILED AND nextRetryAt <= now))
    // AND
    // (lockedBy IS NULL OR lockedAt <= expiryThreshold)
    const eligibleEvents = await db
      .select()
      .from(outboxEvents)
      .where(
        and(
          or(
            eq(outboxEvents.status, "PENDING"),
            and(
              eq(outboxEvents.status, "FAILED"),
              lte(outboxEvents.nextRetryAt, now)
            )
          ),
          or(
            isNull(outboxEvents.lockedBy),
            lte(outboxEvents.lockedAt, expiryThreshold)
          )
        )
      )
      .limit(limit);

    // Update stats gauges
    await this.updateStatsGauges();

    if (eligibleEvents.length === 0) {
      return [];
    }

    const eventIds = eligibleEvents.map(e => e.id);

    // Lock the fetched events
    await db
      .update(outboxEvents)
      .set({
        status: "PROCESSING",
        lockedBy,
        lockedAt: now,
      })
      .where(inArray(outboxEvents.id, eventIds));

    return eligibleEvents.map(e => ({
      ...e,
      status: "PROCESSING",
      lockedBy,
      lockedAt: now,
    }));
  }

  async markAsPublished(id: string): Promise<void> {
    await db
      .update(outboxEvents)
      .set({
        status: "PUBLISHED",
        processedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      })
      .where(eq(outboxEvents.id, id));
    await this.updateStatsGauges();
  }

  async markAsFailed(id: string, error: string, nextRetryAt: Date, currentRetryCount: number): Promise<void> {
    await db
      .update(outboxEvents)
      .set({
        status: "FAILED",
        retryCount: currentRetryCount + 1,
        lastError: error,
        nextRetryAt,
        lockedBy: null,
        lockedAt: null,
      })
      .where(eq(outboxEvents.id, id));
    await this.updateStatsGauges();
  }

  async markAsDead(id: string, error: string): Promise<void> {
    await db
      .update(outboxEvents)
      .set({
        status: "DEAD",
        lastError: error,
        lockedBy: null,
        lockedAt: null,
      })
      .where(eq(outboxEvents.id, id));
    await this.updateStatsGauges();
  }
}

export const outboxRepository = new OutboxRepository();

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { db } from "../config/db";
import { outboxEvents } from "@shared/schema";
import { OutboxWorker } from "./outbox.worker";
import { EventBus } from "../events/event-bus";
import { ExecutionSavedEvent } from "../events/events";
import { eq } from "drizzle-orm";

describe("Transactional Outbox Integration Tests", () => {
  let oldNodeEnv: string;
  let oldBypass: string | undefined;

  beforeEach(async () => {
    oldNodeEnv = process.env.NODE_ENV || "test";
    oldBypass = process.env.BYPASS_OUTBOX;
    
    // Clear outbox events table before test
    await db.delete(outboxEvents);
  });

  afterEach(() => {
    process.env.NODE_ENV = oldNodeEnv;
    process.env.BYPASS_OUTBOX = oldBypass;
  });

  it("should write event to outbox when publish is called, and worker should successfully publish it", async () => {
    // Enable outbox by setting environment
    process.env.NODE_ENV = "production";
    process.env.BYPASS_OUTBOX = "false";

    const eventBus = EventBus.getInstance();
    let localEventReceived = false;

    // Register a subscriber to catch the local event trigger
    eventBus.subscribe("ExecutionSavedEvent", (event) => {
      if (event.payload.requestId === 1337) {
        localEventReceived = true;
      }
    });

    const testEvent = new ExecutionSavedEvent({
      requestId: 1337,
      actorId: "test-actor-id",
      execution: { status: "completed" },
      request: { id: 1337 },
    });

    // 1. Publish event -> should be written to Outbox table, not fired locally yet
    await eventBus.publish(testEvent);
    expect(localEventReceived).toBe(false);

    // Verify it is in the database as PENDING
    const [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, testEvent.id))
      .limit(1);

    expect(record).toBeDefined();
    expect(record.status).toBe("PENDING");
    expect(record.eventName).toBe("ExecutionSavedEvent");

    // 2. Run the OutboxWorker once
    const worker = new OutboxWorker({ intervalMs: 1000, batchSize: 5 });
    await worker.runOnce();

    // 3. Verify event is now processed and fired locally
    expect(localEventReceived).toBe(true);

    // Verify database record status is now PUBLISHED
    const [updatedRecord] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, testEvent.id))
      .limit(1);

    expect(updatedRecord.status).toBe("PUBLISHED");
    expect(updatedRecord.processedAt).toBeDefined();
  });

  it("should increment retry count on failure and eventually mark as DEAD", async () => {
    process.env.NODE_ENV = "production";
    process.env.BYPASS_OUTBOX = "false";

    const eventBus = EventBus.getInstance();

    // Register a subscriber that ALWAYS throws an error to force outbox execution failure
    eventBus.subscribe("ExecutionSavedEvent", (event) => {
      if (event.payload.requestId === 9999) {
        throw new Error("Simulated Subscriber Failure");
      }
    });

    const failingEvent = new ExecutionSavedEvent({
      requestId: 9999,
      actorId: "test-actor-id",
      execution: { status: "failed" },
      request: { id: 9999 },
    });

    // 1. Publish
    await eventBus.publish(failingEvent);

    const worker = new OutboxWorker({ intervalMs: 1000, batchSize: 5 });

    // Run 1: Attempt 1 -> should fail and increment retryCount to 1, status = FAILED
    await worker.runOnce();

    let [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, failingEvent.id))
      .limit(1);

    expect(record.status).toBe("FAILED");
    expect(record.retryCount).toBe(1);
    expect(record.lastError).toBe("Simulated Subscriber Failure");

    // Run 2: Since nextRetryAt is in the future, it should NOT process it again immediately
    await worker.runOnce();
    [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, failingEvent.id))
      .limit(1);
    expect(record.retryCount).toBe(1); // Still 1 because it wasn't picked up due to retry delay

    // Fast-forward the nextRetryAt timestamp to allow immediate pick up
    await db
      .update(outboxEvents)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(outboxEvents.id, failingEvent.id));

    // Run 3: Attempt 2 -> should fail and increment retryCount to 2, status = FAILED
    await worker.runOnce();
    [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, failingEvent.id))
      .limit(1);
    expect(record.retryCount).toBe(2);

    // Fast-forward again
    await db
      .update(outboxEvents)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(outboxEvents.id, failingEvent.id));

    // Run 4: Attempt 3 -> should exceed max retries and promote to DEAD
    await worker.runOnce();
    [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, failingEvent.id))
      .limit(1);

    expect(record.status).toBe("DEAD");
  });
});

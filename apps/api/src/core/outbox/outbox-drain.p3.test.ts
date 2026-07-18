import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { db } from "../config/db";
import { outboxEvents } from "@shared/schema";
import { OutboxWorker } from "./outbox.worker";
import { EventBus } from "../events/event-bus";
import { ExecutionSavedEvent } from "../events/events";
import { eq } from "drizzle-orm";

/**
 * ERP-008 Phase 3 — proves OutboxWorker.stop() awaits the runOnce() batch
 * that start() kicked off, instead of returning while it's still publishing,
 * using the real outbox_events table and a real subscriber (no mocks).
 */
describe("ERP-008 Phase 3 — OutboxWorker graceful stop drains the in-flight batch", () => {
  let oldNodeEnv: string;
  let oldBypass: string | undefined;

  beforeEach(async () => {
    oldNodeEnv = process.env.NODE_ENV || "test";
    oldBypass = process.env.BYPASS_OUTBOX;
    await db.delete(outboxEvents);
  });

  afterEach(() => {
    process.env.NODE_ENV = oldNodeEnv;
    process.env.BYPASS_OUTBOX = oldBypass;
  });

  it("stop() resolves only after the in-flight runOnce() batch has finished publishing", async () => {
    process.env.NODE_ENV = "production";
    process.env.BYPASS_OUTBOX = "false";

    const eventBus = EventBus.getInstance();
    let subscriberFinished = false;

    eventBus.subscribe("ExecutionSavedEvent", async (event) => {
      if (event.payload.requestId === 424242) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        subscriberFinished = true;
      }
    });

    const testEvent = new ExecutionSavedEvent({
      requestId: 424242,
      actorId: "test-actor-drain",
      execution: { status: "completed" },
      request: { id: 424242 },
    });
    await eventBus.publish(testEvent);

    const worker = new OutboxWorker({ intervalMs: 60000, batchSize: 5 });
    worker.start(); // kicks off runOnce() immediately, in flight

    await worker.stop(); // must await that in-flight runOnce() before returning

    expect(subscriberFinished).toBe(true);

    const [record] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, testEvent.id))
      .limit(1);
    expect(record.status).toBe("PUBLISHED");
  });
});

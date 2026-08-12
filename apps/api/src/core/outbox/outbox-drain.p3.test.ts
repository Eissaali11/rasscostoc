import { describe, expect, it, beforeEach, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { db } from "../config/db";
import {
  outboxEvents,
  users,
  itemTypes,
  items,
  inventoryTransactions,
  itemHistoryLogs,
} from "@shared/schema";
import { OutboxWorker } from "./outbox.worker";
import { outboxRepository } from "./outbox.repository";
import { EventBus } from "../events/event-bus";
import { ExecutionSavedEvent, ExecutionCompletedEvent } from "../events/events";
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

/**
 * [WORKER-ONLY — NOT proof of the real inventory integration]
 *
 * OutboxWorker's OWN retry-count/backoff/DEAD state machine, exercised
 * against real outbox_events rows and a real (but inline, non-production)
 * subscriber standing in for ANY business handler, purely to drive real DB
 * writes for the assertions below.
 *
 * This file (apps/api/src/core/outbox/) is architecturally forbidden from
 * importing business modules — core-should-not-depend-on-business-modules
 * is an enforced `error`-severity rule, confirmed via
 * lint:architecture:strict — so it deliberately does NOT construct the
 * real InventorySubscriber or InventoryEngine, and nothing in this
 * describe block may be cited as evidence that the real subscriber/engine
 * chain works correctly.
 *
 * The REAL ExecutionCompletedEvent → OutboxWorker.runOnce() → real
 * EventBus → real InventorySubscriber → real idempotencyService.execute →
 * real InventoryEngine.deduct → real transaction runner → real
 * serialized/general repositories chain is proven end-to-end, with real
 * success/transient-retry/permanent-DEAD/concurrent-replay scenarios, in:
 *
 *   apps/api/src/modules/inventory/infrastructure/subscribers/inventory.subscriber.test.ts
 *   describe("OPS-REMED-E3-F.R1 — real production chain
 *     (OutboxWorker → InventorySubscriber → InventoryEngine)")
 *   — scenarios A (success), B (transient→success), C (permanent→DEAD),
 *     D (concurrent claim, no duplicate deduction).
 *
 * (a business-layer file, where importing OutboxWorker from core is the
 * architecturally allowed direction). THIS suite's sole job is the
 * worker's own state machine (retry count, backoff persistence, DEAD
 * transition, dead-letter payload) — not the business logic it dispatches
 * to.
 */
describe("[WORKER-ONLY] OutboxWorker retry / backoff / DEAD state machine (not the real subscriber/engine chain — see inventory.subscriber.test.ts scenarios A–D for that)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }

    // Inline stand-in for InventorySubscriber's real deduction logic:
    // fails while the target item isn't in custody yet, succeeds (with a
    // real, single write) once it is — same shape of transient-then-
    // resolves condition the real subscriber handles, without importing it.
    EventBus.getInstance().subscribe("ExecutionCompletedEvent", async (event: any) => {
      const { requestId, execution } = event.payload;
      const serial = execution?.sn;
      const [item] = await db.select().from(items).where(eq(items.serialNumber, serial));
      if (!item || item.status !== "RECEIVED_BY_TECHNICIAN") {
        throw new Error(
          `[test-inline-subscriber] Serial "${serial}" not found in active custody for request ${requestId}.`
        );
      }
      await db.transaction(async (tx) => {
        await tx.update(items).set({ status: "DELIVERED", currentOwnerId: null }).where(eq(items.id, item.id));
        await tx.insert(inventoryTransactions).values({
          itemId: item.id,
          transactionType: "DELIVERY",
          sourceOwnerId: item.currentOwnerId,
          orderNumber: String(requestId),
          notes: "test-inline-subscriber delivery",
        });
        await tx.insert(itemHistoryLogs).values({
          itemId: item.id,
          fromStatus: item.status,
          toStatus: "DELIVERED",
          changedById: item.currentOwnerId,
          notes: "test-inline-subscriber delivery",
        });
      });
    });
  });

  const createdUserIds: string[] = [];
  const createdItemTypeIds: string[] = [];
  const createdItemIds: string[] = [];

  beforeEach(async () => {
    await db.delete(outboxEvents);
  });

  afterEach(async () => {
    for (const id of createdItemIds.splice(0)) {
      await db.delete(inventoryTransactions).where(eq(inventoryTransactions.itemId, id)).catch(() => {});
      await db.delete(itemHistoryLogs).where(eq(itemHistoryLogs.itemId, id)).catch(() => {});
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
    await db.delete(outboxEvents);
  });

  function testSerial(prefix: string): string {
    return (prefix + randomUUID().slice(0, 10)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  async function seedTechnician(label: string) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `e3-obx-${label}-${id.slice(0, 8)}`,
      email: `e3-obx-${label}-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: `E3 Outbox ${label}`,
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedItemInCustody(ownerId: string, serialNumber: string) {
    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: `نوع-${itemTypeId.slice(0, 8)}`,
      nameEn: `Type-${itemTypeId.slice(0, 8)}`,
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId);

    const itemId = randomUUID();
    await db.insert(items).values({
      id: itemId,
      itemTypeId,
      serialNumber,
      barcode: `${serialNumber}-BAR`,
      status: "RECEIVED_BY_TECHNICIAN",
      currentOwnerId: ownerId,
    });
    createdItemIds.push(itemId);
    return itemId;
  }

  /** Force the outbox row eligible for immediate re-claim, bypassing the real backoff wait. */
  async function makeRetryEligibleNow(eventId: string) {
    await db
      .update(outboxEvents)
      .set({ nextRetryAt: new Date(Date.now() - 1000), status: "FAILED" })
      .where(eq(outboxEvents.id, eventId));
  }

  it(
    "[WORKER-ONLY] a transient inline-handler failure retries and ultimately succeeds exactly once, with no duplicate movement/history rows",
    async () => {
      const tech = await seedTechnician("transient");
      const requestId = 930001;
      const serial = testSerial("E3OBXTR");

      // Attempt 1 must fail: the asset is NOT yet in custody (simulates a
      // real transient condition — e.g. a not-yet-committed upstream write
      // — that resolves itself before the retry).
      const event = new ExecutionCompletedEvent({
        requestId,
        actorId: tech,
        execution: {
          sn: serial,
          technicianCode: `e3-obx-transient-${tech.slice(0, 8)}`,
          installationStatus: "Installation Completed - NL",
        },
        request: {
          id: requestId,
          customerName: "Test Customer",
          incidentNumber: String(requestId),
        },
      });
      await outboxRepository.enqueue(event);

      const worker = new OutboxWorker({ intervalMs: 60000, batchSize: 5 });

      await worker.runOnce();
      let [record] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
      expect(record!.status).toBe("FAILED");
      expect(record!.retryCount).toBe(1);

      // The item now enters custody — the condition that caused attempt 1
      // to fail has resolved, exactly as a genuine transient failure would.
      const itemId = await seedItemInCustody(tech, serial);

      await makeRetryEligibleNow(event.id);
      await worker.runOnce();

      [record] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
      expect(record!.status).toBe("PUBLISHED");

      const [item] = await db.select().from(items).where(eq(items.id, itemId));
      expect(item!.status).toBe("DELIVERED");

      // Deduction happened exactly once — not once per attempt.
      const txRows = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, itemId));
      const historyRows = await db
        .select()
        .from(itemHistoryLogs)
        .where(eq(itemHistoryLogs.itemId, itemId));
      expect(txRows.length).toBe(1);
      expect(historyRows.length).toBe(1);

    },
    30000
  );

  it(
    "[WORKER-ONLY] a permanent inline-handler failure exhausts bounded retries and reaches DEAD, with zero partial inventory writes",
    async () => {
      const tech = await seedTechnician("permanent");
      const requestId = 930002;
      // Deliberately never seeded into custody — the failure never
      // resolves, across every attempt.
      const missingSerial = testSerial("E3OBXPERM");

      const event = new ExecutionCompletedEvent({
        requestId,
        actorId: tech,
        execution: {
          sn: missingSerial,
          technicianCode: `e3-obx-permanent-${tech.slice(0, 8)}`,
          installationStatus: "Installation Completed - NL",
        },
        request: {
          id: requestId,
          customerName: "Test Customer",
          incidentNumber: String(requestId),
        },
      });
      await outboxRepository.enqueue(event);

      let deadLetterEvent: any = null;
      const eventBus = EventBus.getInstance();
      eventBus.subscribe("InventoryDeductionFailedEvent", async (e: any) => {
        if (e.payload.requestId === requestId) deadLetterEvent = e;
      });

      const worker = new OutboxWorker({ intervalMs: 60000, batchSize: 5 });

      // The worker's own bounded-retry policy: 3 attempts total, then DEAD.
      for (let attempt = 1; attempt <= 3; attempt++) {
        await worker.runOnce();
        if (attempt < 3) {
          await makeRetryEligibleNow(event.id);
        }
      }

      const [record] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, event.id));
      expect(record!.status).toBe("DEAD");
      // markAsDead does not itself bump retryCount (only markAsFailed
      // does) — so after 2 FAILED transitions followed by the 3rd attempt
      // going straight to DEAD, the persisted count is 2, reflecting the
      // 2 recorded retry attempts before the terminal one.
      expect(record!.retryCount).toBe(2);

      // The structured failure event carries the request identity and the
      // underlying structured error content, not a bare generic message.
      expect(deadLetterEvent).not.toBeNull();
      expect(deadLetterEvent.payload.requestId).toBe(requestId);
      expect(String(deadLetterEvent.payload.errors[0])).toMatch(/DEDUCT_|failed/i);

      // Zero partial writes across all 3 attempts — no item was created or
      // touched for this serial at all.
      const [ghostItem] = await db.select().from(items).where(eq(items.serialNumber, missingSerial));
      expect(ghostItem).toBeUndefined();
    },
    30000
  );
});

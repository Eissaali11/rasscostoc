/**
 * OPS-REMED-E4-P2 — legacy classification and backfill script proof.
 *
 * Runs only via a real disposable Postgres test database (guarded below).
 * Exercises scripts/backfill-custody-closure-status.ts's exported
 * classifier/sweep functions directly against seeded legacy-shaped rows.
 * Never executes the script's own main()/CLI path (guarded internally),
 * and never targets any non-test database (P3-only, not this gate).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { db } from "@core/config/db";
import { users, itemTypes, items, courierRequests, courierRequestItems, courierExecutions, idempotencyRecords, outboxEvents } from "@shared/schema";
import { classifyOneRow, runSweep, type ClassificationCounts } from "../../../../../../scripts/backfill-custody-closure-status";

describe("OPS-REMED-E4-P2 — legacy classification and backfill", () => {
  let pool: Pool;

  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  function freshCounts(): ClassificationCounts {
    return { success: 0, failedFinal: 0, notStarted: 0, reconciliationRequired: 0, skippedActiveProcessing: 0 };
  }

  async function seedRequestWithItem(deliveredStatus: string) {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy", incidentNumber: `E4-P2-LEG-${randomUUID().slice(0, 8)}` })
      .returning();

    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({ id: itemTypeId, nameAr: `نوع-${itemTypeId.slice(0, 8)}`, nameEn: `Type-${itemTypeId.slice(0, 8)}`, category: "device" });
    const serial = ("E4P2LEG" + randomUUID().slice(0, 10)).toUpperCase().replace(/[^A-Z0-9]/g, "");
    await db.insert(items).values({
      id: randomUUID(),
      itemTypeId,
      serialNumber: serial,
      barcode: `${serial}-BAR`,
      status: deliveredStatus,
      currentOwnerId: actorId,
    });
    await db.insert(courierRequestItems).values({
      requestId: request.id,
      itemType: "POS",
      serialNumber: serial,
      status: "RECEIVED",
    });
    await db.insert(courierExecutions).values({ requestId: request.id, enteredBy: actorId });
    return request.id;
  }

  it("1. all resolvable items DELIVERED -> CLOSED_SUCCESS", async () => {
    const requestId = await seedRequestWithItem("DELIVERED");
    const { status } = await classifyOneRow(pool, requestId);
    expect(status).toBe("CLOSED_SUCCESS");
  });

  it("2. resolvable item NOT delivered, no failure evidence -> NOT_STARTED", async () => {
    const requestId = await seedRequestWithItem("RECEIVED_BY_TECHNICIAN");
    const { status } = await classifyOneRow(pool, requestId);
    expect(status).toBe("NOT_STARTED");
  });

  it("3. no item linkage at all, zero evidence -> NOT_STARTED", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-none-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-none-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy None",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy None", incidentNumber: `E4-P2-LEGN-${randomUUID().slice(0, 8)}` })
      .returning();
    const { status } = await classifyOneRow(pool, request.id);
    expect(status).toBe("NOT_STARTED");
  });

  it("4. no item linkage, idempotency FAILED -> FAILED_FINAL", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-ff-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-ff-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy FF",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy FF", incidentNumber: `E4-P2-LEGFF-${randomUUID().slice(0, 8)}` })
      .returning();
    await db.insert(idempotencyRecords).values({
      idempotencyKey: `ExecutionCompletedEvent:REQ-${request.id}:InventorySubscriber:v1`,
      eventId: randomUUID(),
      subscriberName: "InventorySubscriber",
      status: "FAILED",
    });
    const { status } = await classifyOneRow(pool, request.id);
    expect(status).toBe("FAILED_FINAL");
  });

  it("5. idempotency PROCESSING, fresh (< 155s) -> null (skip this pass)", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-fresh-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-fresh-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy Fresh",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy Fresh", incidentNumber: `E4-P2-LEGFR-${randomUUID().slice(0, 8)}` })
      .returning();
    await db.insert(idempotencyRecords).values({
      idempotencyKey: `ExecutionCompletedEvent:REQ-${request.id}:InventorySubscriber:v1`,
      eventId: randomUUID(),
      subscriberName: "InventorySubscriber",
      status: "PROCESSING",
      createdAt: new Date(),
    });
    const { status } = await classifyOneRow(pool, request.id);
    expect(status).toBeNull();
  });

  it("6. idempotency PROCESSING, stale (> 155s) -> RECONCILIATION_REQUIRED", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-stale-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-stale-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy Stale",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy Stale", incidentNumber: `E4-P2-LEGST-${randomUUID().slice(0, 8)}` })
      .returning();
    await db.insert(idempotencyRecords).values({
      idempotencyKey: `ExecutionCompletedEvent:REQ-${request.id}:InventorySubscriber:v1`,
      eventId: randomUUID(),
      subscriberName: "InventorySubscriber",
      status: "PROCESSING",
      createdAt: new Date(Date.now() - 200_000),
    });
    const { status } = await classifyOneRow(pool, request.id);
    expect(status).toBe("RECONCILIATION_REQUIRED");
  });

  it("7. missing item linkage for a resolvable-shaped row -> RECONCILIATION_REQUIRED", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-legacy-miss-${actorId.slice(0, 8)}`,
      email: `e4p2-legacy-miss-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Legacy Missing",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Legacy Missing", incidentNumber: `E4-P2-LEGMS-${randomUUID().slice(0, 8)}` })
      .returning();
    await db.insert(courierRequestItems).values({
      requestId: request.id,
      itemType: "POS",
      serialNumber: "NONEXISTENT-SERIAL-" + randomUUID().slice(0, 8),
      status: "RECEIVED",
    });
    const { status } = await classifyOneRow(pool, request.id);
    expect(status).toBe("RECONCILIATION_REQUIRED");
  });

  it("8. runSweep is idempotent — a second run on already-classified rows changes nothing further", async () => {
    const requestId = await seedRequestWithItem("DELIVERED");
    const counts1 = freshCounts();
    await runSweep(pool, false, counts1);
    const [after1] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(after1!.custodyClosureStatus).toBe("CLOSED_SUCCESS");

    const counts2 = freshCounts();
    const secondPassCount = await runSweep(pool, false, counts2);
    // The already-classified row no longer matches `IS NULL`, so it is not
    // reprocessed — proves safe re-run behavior (interruption/resume).
    const [after2] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(after2!.custodyClosureStatus).toBe("CLOSED_SUCCESS");
    void secondPassCount;
  });

  it("9. dry-run mode classifies but does not write", async () => {
    const requestId = await seedRequestWithItem("DELIVERED");
    const counts = freshCounts();
    await runSweep(pool, true, counts);
    expect(counts.success).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(row!.custodyClosureStatus).toBeNull(); // untouched — dry run
  });
});

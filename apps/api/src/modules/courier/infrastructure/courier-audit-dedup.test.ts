/**
 * OPS-REMED-E4-P2 — atomic dedup+evidence-check+CAS+audit, end to end
 * through the real registered CourierSagaSubscriber handler.
 *
 * Runs only via a real disposable Postgres test database (guarded below).
 * NODE_ENV=test dispatches EventBus.publish synchronously via
 * publishLocal — no outbox round trip needed to exercise the handler.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@core/config/db";
import { users, courierRequests, courierExecutions, courierExecutionAuditDedup, courierAuditLogs, inventoryDeductionCompletions } from "@shared/schema";
import { EventBus } from "@core/events/event-bus";
import { InventoryDeductionFailedEvent } from "@core/events/events";
import { CourierSagaSubscriber } from "./subscribers/courier-saga.subscriber";

describe("OPS-REMED-E4-P2 — CourierSagaSubscriber atomic final-failure/correction", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
    CourierSagaSubscriber.register();
  });

  async function seedExecution(initialStatus: string): Promise<{ requestId: number; actorId: string }> {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-saga-${actorId.slice(0, 8)}`,
      email: `e4p2-saga-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Saga Actor",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Saga", incidentNumber: `E4-P2-SAGA-${randomUUID().slice(0, 8)}` })
      .returning();
    await db.insert(courierExecutions).values({
      requestId: request.id,
      enteredBy: actorId,
      custodyClosureStatus: initialStatus,
    });
    return { requestId: request.id, actorId };
  }

  it("1. final:true with no completion evidence -> FAILED_FINAL, audit row written, dedup row exists", async () => {
    const { requestId, actorId } = await seedExecution("FAILED_RETRYABLE");
    const sourceEventId = randomUUID();
    await EventBus.getInstance().publish(
      new InventoryDeductionFailedEvent({
        requestId,
        actorId,
        technicianCode: "t",
        errors: ["fail"],
        final: true,
        sourceEventId,
      })
    );

    const [exec] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(exec!.custodyClosureStatus).toBe("FAILED_FINAL");

    const dedup = await db
      .select()
      .from(courierExecutionAuditDedup)
      .where(and(eq(courierExecutionAuditDedup.sourceEventId, sourceEventId), eq(courierExecutionAuditDedup.operationKind, "FINAL_FAILURE")));
    expect(dedup.length).toBe(1);

    const audit = await db.select().from(courierAuditLogs).where(eq(courierAuditLogs.recordId, requestId));
    expect(audit.some((a) => a.action === "custody_closure_final_failure")).toBe(true);
  });

  it("2. final:true WITH completion evidence -> corrected to CLOSED_SUCCESS, not FAILED_FINAL", async () => {
    const { requestId, actorId } = await seedExecution("FAILED_RETRYABLE");
    const sourceEventId = randomUUID();
    await db.insert(inventoryDeductionCompletions).values({
      requestId,
      sourceEventId: randomUUID(), // the deduction's own causal id, independent of this failure signal's
      generalInventoryDeducted: true,
      serializedItemCount: 0,
    });

    await EventBus.getInstance().publish(
      new InventoryDeductionFailedEvent({
        requestId,
        actorId,
        technicianCode: "t",
        errors: ["stale failure signal"],
        final: true,
        sourceEventId,
      })
    );

    const [exec] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(exec!.custodyClosureStatus).toBe("CLOSED_SUCCESS");

    const audit = await db.select().from(courierAuditLogs).where(eq(courierAuditLogs.recordId, requestId));
    expect(audit.some((a) => a.action === "custody_closure_corrected")).toBe(true);
  });

  it("3. correction also applies when the row was ALREADY FAILED_FINAL (defensive, A.9 §6)", async () => {
    const { requestId, actorId } = await seedExecution("FAILED_FINAL");
    const sourceEventId = randomUUID();
    await db.insert(inventoryDeductionCompletions).values({
      requestId,
      sourceEventId: randomUUID(),
      generalInventoryDeducted: false,
      serializedItemCount: 1,
    });

    await EventBus.getInstance().publish(
      new InventoryDeductionFailedEvent({
        requestId,
        actorId,
        technicianCode: "t",
        errors: ["late duplicate"],
        final: true,
        sourceEventId,
      })
    );

    const [exec] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    expect(exec!.custodyClosureStatus).toBe("CLOSED_SUCCESS");
  });

  it("4. duplicate delivery of the SAME final-failure event is a clean no-op (no duplicate audit row)", async () => {
    const { requestId, actorId } = await seedExecution("FAILED_RETRYABLE");
    const sourceEventId = randomUUID();
    const event = new InventoryDeductionFailedEvent({
      requestId,
      actorId,
      technicianCode: "t",
      errors: ["fail"],
      final: true,
      sourceEventId,
    });

    await EventBus.getInstance().publish(event);
    await EventBus.getInstance().publish(event); // redelivery of the identical logical failure

    const audit = await db
      .select()
      .from(courierAuditLogs)
      .where(and(eq(courierAuditLogs.recordId, requestId), eq(courierAuditLogs.action, "custody_closure_final_failure")));
    expect(audit.length).toBe(1);
  });

  it("5. attempt-level (final absent) events do not trigger the final-transition path at all", async () => {
    const { requestId, actorId } = await seedExecution("PROCESSING");
    await EventBus.getInstance().publish(
      new InventoryDeductionFailedEvent({
        requestId,
        actorId,
        technicianCode: "t",
        errors: ["transient"],
      })
    );
    const [exec] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    // Unchanged by the saga's final-transition path (the compensating
    // installationStatus revert still runs, unmodified — unrelated field).
    expect(exec!.custodyClosureStatus).toBe("PROCESSING");
  });
});

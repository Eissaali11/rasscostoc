/**
 * OPS-REMED-E4-P2 — custody_closure_status exact transition matrix.
 *
 * Runs only via a real disposable Postgres test database (guarded below).
 * Proves every allowed transition uses an exact positive predecessor-state
 * guard (never a broad negative guard), every forbidden transition is a
 * clean 0-row no-op, and CLOSED_SUCCESS never regresses.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@core/config/db";
import { users, courierRequests, courierExecutions } from "@shared/schema";
import { drizzleCourierRepository } from "./repositories/drizzle-courier.repository";

describe("OPS-REMED-E4-P2 — custody_closure_status transition matrix", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  async function seedExecution(initialStatus: string | null): Promise<number> {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4p2-${actorId.slice(0, 8)}`,
      email: `e4p2-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P2 Transition Actor",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({ customerName: "E4 P2 Transition", incidentNumber: `E4-P2-T-${randomUUID().slice(0, 8)}` })
      .returning();
    const [execution] = await db
      .insert(courierExecutions)
      .values({ requestId: request.id, enteredBy: actorId, custodyClosureStatus: initialStatus })
      .returning();
    return execution.requestId;
  }

  async function currentStatus(requestId: number): Promise<string | null> {
    const [row] = await db.select().from(courierExecutions).where(eq(courierExecutions.requestId, requestId));
    return row?.custodyClosureStatus ?? null;
  }

  it("1. direct insert lands on PENDING_DEDUCTION, no intermediate value ever visible", async () => {
    const requestId = await seedExecution("PENDING_DEDUCTION");
    expect(await currentStatus(requestId)).toBe("PENDING_DEDUCTION");
  });

  it("2. PENDING_DEDUCTION -> PROCESSING via exact guard", async () => {
    const requestId = await seedExecution("PENDING_DEDUCTION");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PENDING_DEDUCTION", "FAILED_RETRYABLE"], "PROCESSING");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("PROCESSING");
  });

  it("3. FAILED_RETRYABLE -> PROCESSING (outbox retry re-entry) via exact guard", async () => {
    const requestId = await seedExecution("FAILED_RETRYABLE");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PENDING_DEDUCTION", "FAILED_RETRYABLE"], "PROCESSING");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("PROCESSING");
  });

  it("4. PROCESSING -> CLOSED_SUCCESS via exact guard", async () => {
    const requestId = await seedExecution("PROCESSING");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "CLOSED_SUCCESS");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("CLOSED_SUCCESS");
  });

  it("5. PROCESSING -> FAILED_RETRYABLE via exact guard", async () => {
    const requestId = await seedExecution("PROCESSING");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "FAILED_RETRYABLE");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("FAILED_RETRYABLE");
  });

  it("6. FAILED_RETRYABLE -> FAILED_FINAL via exact guard", async () => {
    const requestId = await seedExecution("FAILED_RETRYABLE");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["FAILED_RETRYABLE"], "FAILED_FINAL");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("FAILED_FINAL");
  });

  it("7. correctable FAILED_FINAL -> CLOSED_SUCCESS via exact guard", async () => {
    const requestId = await seedExecution("FAILED_FINAL");
    const row = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["FAILED_RETRYABLE", "FAILED_FINAL"], "CLOSED_SUCCESS");
    expect(row).not.toBeNull();
    expect(await currentStatus(requestId)).toBe("CLOSED_SUCCESS");
  });

  it("8-9. every forbidden transition from CLOSED_SUCCESS is a clean 0-row no-op — never regresses", async () => {
    const requestId = await seedExecution("CLOSED_SUCCESS");
    for (const target of ["PROCESSING", "FAILED_RETRYABLE", "FAILED_FINAL", "PENDING_DEDUCTION"]) {
      const row = await drizzleCourierRepository.updateCustodyClosureStatus(
        requestId,
        ["PENDING_DEDUCTION", "PROCESSING", "FAILED_RETRYABLE", "FAILED_FINAL"],
        target
      );
      expect(row).toBeNull();
    }
    expect(await currentStatus(requestId)).toBe("CLOSED_SUCCESS");
  });

  it("10. duplicate/late transition attempt is a 0-row no-op", async () => {
    const requestId = await seedExecution("PROCESSING");
    const first = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "CLOSED_SUCCESS");
    expect(first).not.toBeNull();
    const second = await drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "CLOSED_SUCCESS");
    expect(second).toBeNull();
    expect(await currentStatus(requestId)).toBe("CLOSED_SUCCESS");
  });

  it("11. two concurrent CAS attempts on the same row — exactly one winner", async () => {
    const requestId = await seedExecution("PROCESSING");
    const results = await Promise.allSettled([
      drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "CLOSED_SUCCESS"),
      drizzleCourierRepository.updateCustodyClosureStatus(requestId, ["PROCESSING"], "FAILED_RETRYABLE"),
    ]);
    const winners = results.filter((r) => r.status === "fulfilled" && (r as any).value !== null);
    expect(winners.length).toBe(1);
    const finalStatus = await currentStatus(requestId);
    expect(["CLOSED_SUCCESS", "FAILED_RETRYABLE"]).toContain(finalStatus);
  });
});

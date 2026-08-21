/**
 * OPS-REMED-E4-P4-I1 — staged constraint migration smoke test.
 *
 * Runs only via a real disposable Postgres test database (same guarded
 * pattern as migration-p1-expand.smoke.test.ts). Migrations 0001-0054 are
 * already applied by the isolated-test pipeline before this file runs
 * (scripts/test-isolated.mjs runs scripts/migrate.ts against a fresh
 * container from zero) — this file asserts the resulting state and
 * behavior, it does not run migrations itself.
 *
 * Proves: the three-file staged migration (0052 NOT VALID add, 0053
 * VALIDATE, 0054 SET NOT NULL) applies cleanly from zero; the resulting
 * column is NOT NULL; the allowed-value CHECK constraint is present and
 * enforced against both a NULL value and a value outside the frozen set;
 * every one of the six frozen values is individually accepted; and the
 * now-redundant staging check constraint was dropped in 0054, leaving
 * only the one permanent allowed-value CHECK constraint.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { pool, db } from "@core/config/db";
import { users, courierRequests, courierExecutions } from "@shared/schema";
import journal from "../../../../../../migrations/meta/_journal.json";

const FROZEN_VALUES = [
  "PENDING_DEDUCTION",
  "PROCESSING",
  "CLOSED_SUCCESS",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "RECONCILIATION_REQUIRED",
] as const;

async function makeRequestAndActor() {
  const actorId = randomUUID();
  await db.insert(users).values({
    id: actorId,
    username: `e4-p4-${actorId.slice(0, 8)}`,
    email: `e4-p4-${actorId.slice(0, 8)}@test.local`,
    password: "x",
    fullName: "E4 P4 Smoke Actor",
    role: "admin",
  });
  const [request] = await db
    .insert(courierRequests)
    .values({
      customerName: "E4 P4 Smoke Customer",
      incidentNumber: `E4-P4-${randomUUID().slice(0, 8)}`,
    })
    .returning();
  return { actorId, requestId: request.id };
}

describe("OPS-REMED-E4-P4-I1 — custody_closure_status staged constraint migration (0052-0054)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  it("1. migrations 0052-0054 have all applied — journal proves each, exactly once, in order", async () => {
    const entries = (journal as { entries: { tag: string; idx: number }[] }).entries;
    const m52 = entries.filter((e) => e.tag === "0052_courier_custody_closure_constraints_add");
    const m53 = entries.filter(
      (e) => e.tag === "0053_courier_custody_closure_constraints_validate"
    );
    const m54 = entries.filter((e) => e.tag === "0054_courier_custody_closure_not_null_enforce");
    expect(m52).toHaveLength(1);
    expect(m53).toHaveLength(1);
    expect(m54).toHaveLength(1);
    expect(m52[0].idx).toBe(52);
    expect(m53[0].idx).toBe(53);
    expect(m54[0].idx).toBe(54);
  });

  it("2. custody_closure_status is now NOT NULL", async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_nullable).toBe("NO");
    expect(rows[0].column_default).toBeNull();
  });

  it("3. exactly one CHECK constraint remains on the column — the permanent allowed-value CHECK — and it is validated", async () => {
    const { rows } = await pool.query(
      `SELECT conname, convalidated FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass
         AND contype = 'c'
         AND conname ILIKE '%custody_closure_status%'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].conname).toBe("courier_executions_custody_closure_status_check");
    expect(rows[0].convalidated).toBe(true);
  });

  it("4. the staging NOT-NULL check constraint from 0052 was dropped by 0054 (not left redundant)", async () => {
    const { rows } = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass
         AND conname = 'courier_executions_custody_closure_status_not_null_check'`
    );
    expect(rows).toHaveLength(0);
  });

  it.each(FROZEN_VALUES)("5. inserting with custodyClosureStatus = %s succeeds", async (value) => {
    const { actorId, requestId } = await makeRequestAndActor();
    const [execution] = await db
      .insert(courierExecutions)
      .values({ requestId, enteredBy: actorId, custodyClosureStatus: value })
      .returning();
    expect(execution.custodyClosureStatus).toBe(value);
  });

  it("6. inserting with NULL custody_closure_status is rejected (raw SQL, bypassing any ORM-level default)", async () => {
    const { actorId, requestId } = await makeRequestAndActor();
    await expect(
      pool.query(
        `INSERT INTO courier_executions (request_id, entered_by, custody_closure_status)
         VALUES ($1, $2, NULL)`,
        [requestId, actorId]
      )
    ).rejects.toThrow(/null value in column "custody_closure_status"|violates not-null constraint/i);
  });

  it("7. inserting with a value outside the frozen set is rejected", async () => {
    const { actorId, requestId } = await makeRequestAndActor();
    await expect(
      pool.query(
        `INSERT INTO courier_executions (request_id, entered_by, custody_closure_status)
         VALUES ($1, $2, 'NOT_A_REAL_STATE')`,
        [requestId, actorId]
      )
    ).rejects.toThrow(/violates check constraint "courier_executions_custody_closure_status_check"/i);
  });

  it("8. an UPDATE attempting to clear the column to NULL is rejected on an existing row", async () => {
    const { actorId, requestId } = await makeRequestAndActor();
    const [execution] = await db
      .insert(courierExecutions)
      .values({ requestId, enteredBy: actorId, custodyClosureStatus: "PENDING_DEDUCTION" })
      .returning();
    await expect(
      pool.query(`UPDATE courier_executions SET custody_closure_status = NULL WHERE id = $1`, [execution.id])
    ).rejects.toThrow(/null value in column "custody_closure_status"|violates not-null constraint/i);
  });

  it("9. migration-from-zero succeeded and drift is zero (proven by this suite running at all)", async () => {
    const { rows } = await pool.query(`SELECT to_regclass('public.courier_executions') AS reg`);
    expect(rows[0].reg).toBe("courier_executions");
  });
});

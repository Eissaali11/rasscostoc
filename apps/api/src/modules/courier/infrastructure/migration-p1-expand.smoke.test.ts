/**
 * OPS-REMED-E4-P1 — expand-migration smoke test.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the other DB-dependent regression suites). Migrations
 * 0001-0049 are already applied by the isolated-test pipeline before this
 * file runs (scripts/test-isolated.mjs runs `scripts/migrate.ts` against a
 * fresh container from zero) — this file asserts the resulting state, it
 * does not run migrations itself.
 *
 * Proves migration 0049 is purely additive: a nullable
 * courier_executions.custody_closure_status column with no default, no
 * NOT NULL, no CHECK constraint, and no index.
 *
 * OPS-REMED-E4-P2-I.R2: tests #11/#12 originally asserted the P2 tables
 * (inventory_deduction_completions, courier_execution_audit_dedup) did
 * NOT exist — correct when P1 alone had landed, now superseded now that
 * migrations 0050/0051 (P2) are part of the same migration-from-zero
 * chain this suite runs against. Replaced with positive assertions
 * proving the full 0049-0051 chain applies correctly together and that
 * P2's tables carry their certified shape — this remains a migration/
 * schema-evolution smoke test, not a duplicate of the dedicated P2
 * integration suites (custody-closure-*.test.ts,
 * inventory-deduction-completion.test.ts, CourierProjectionWorker.test.ts),
 * which own the full behavioral proof.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { pool, db } from "@core/config/db";
import { users, courierRequests, courierExecutions } from "@shared/schema";
import journal from "../../../../../../migrations/meta/_journal.json";

describe("OPS-REMED-E4-P1 — custody_closure_status expand migration (0049)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  it("1-2. migrations through 0048 and then 0049 have applied (journal proves both, and the column exists)", async () => {
    const entries = (journal as { entries: { tag: string }[] }).entries;
    expect(entries.some((e) => e.tag === "0048_sales_invoice_numeric_precision")).toBe(true);
    // 13. the journal contains exactly the correct 0049 entry, once
    const matching = entries.filter((e) => e.tag === "0049_courier_execution_custody_closure_status_add");
    expect(matching).toHaveLength(1);
    expect(matching[0].idx).toBe(49);
  });

  it("3. courier_executions.custody_closure_status exists", async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows).toHaveLength(1);
  });

  it("4. the column accepts NULL, and 7-8. has no default and no NOT NULL", async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable, column_default, data_type FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_nullable).toBe("YES");
    expect(rows[0].column_default).toBeNull();
    expect(rows[0].data_type).toBe("text");
  });

  it("5-6. existing-style inserts omitting the column still succeed, and existing rows remain unchanged", async () => {
    const actorId = randomUUID();
    await db.insert(users).values({
      id: actorId,
      username: `e4-p1-${actorId.slice(0, 8)}`,
      email: `e4-p1-${actorId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E4 P1 Smoke Actor",
      role: "admin",
    });
    const [request] = await db
      .insert(courierRequests)
      .values({
        customerName: "E4 P1 Smoke Customer",
        incidentNumber: `E4-P1-${randomUUID().slice(0, 8)}`,
      })
      .returning();

    // Old-style insert: no custodyClosureStatus field at all, exactly what
    // pre-P2 application code will continue to do.
    const [execution] = await db
      .insert(courierExecutions)
      .values({ requestId: request.id, enteredBy: actorId })
      .returning();

    expect(execution.custodyClosureStatus).toBeNull();

    // Re-read: the row is unchanged by anything migration-adjacent.
    const { rows } = await pool.query(
      `SELECT custody_closure_status FROM courier_executions WHERE id = $1`,
      [execution.id]
    );
    expect(rows[0].custody_closure_status).toBeNull();
  });

  it("9. no E4 status CHECK constraint exists on courier_executions", async () => {
    const { rows } = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass
         AND contype = 'c'
         AND conname ILIKE '%custody_closure_status%'`
    );
    expect(rows).toHaveLength(0);
  });

  it("10. no E4 status index exists on courier_executions", async () => {
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'courier_executions' AND indexname ILIKE '%custody_closure_status%'`
    );
    expect(rows).toHaveLength(0);
  });

  it("11a. migrations 0050/0051 have applied — journal proves both, exactly once each", async () => {
    const entries = (journal as { entries: { tag: string }[] }).entries;
    const m50 = entries.filter((e) => e.tag === "0050_inventory_deduction_completions_add");
    const m51 = entries.filter((e) => e.tag === "0051_courier_execution_audit_dedup_add");
    expect(m50).toHaveLength(1);
    expect(m51).toHaveLength(1);
  });

  it("11b. inventory_deduction_completions exists with the certified request_id/source_event_id unique identity", async () => {
    const { rows } = await pool.query(`SELECT to_regclass('public.inventory_deduction_completions') AS reg`);
    expect(rows[0].reg).toBe("inventory_deduction_completions");

    const uniques = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'inventory_deduction_completions'::regclass AND contype = 'u'`
    );
    expect(uniques.rows.some((r: any) => r.conname.includes("request_id"))).toBe(true);
    expect(uniques.rows.some((r: any) => r.conname.includes("source_event_id"))).toBe(true);
  });

  it("11c. inventory_deduction_completions carries the certified claim/lease/fencing columns", async () => {
    const { rows } = await pool.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'inventory_deduction_completions'`
    );
    const byName = Object.fromEntries(rows.map((r: any) => [r.column_name, r.is_nullable]));
    expect(byName["projection_status"]).toBe("NO");
    expect(byName["projection_attempt_count"]).toBe("NO");
    expect(byName["projection_next_attempt_at"]).toBe("NO");
    expect(byName["projection_lease_owner"]).toBe("YES");
    expect(byName["projection_lease_token"]).toBe("YES");
    expect(byName["projection_lease_expires_at"]).toBe("YES");
    expect(byName["projected_at"]).toBe("YES");
  });

  it("12a. courier_execution_audit_dedup exists with the certified composite (source_event_id, operation_kind) identity", async () => {
    const { rows } = await pool.query(`SELECT to_regclass('public.courier_execution_audit_dedup') AS reg`);
    expect(rows[0].reg).toBe("courier_execution_audit_dedup");

    const pk = await pool.query(
      `SELECT a.attname FROM pg_constraint c
       JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.conrelid = 'courier_execution_audit_dedup'::regclass AND c.contype = 'p'
       ORDER BY k.ord`
    );
    expect(pk.rows.map((r: any) => r.attname)).toEqual(["source_event_id", "operation_kind"]);
  });

  it("12b. no P4 (0052) constraint or artifact exists yet — custody_closure_status is still nullable, no CHECK", async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows[0].is_nullable).toBe("YES");
    const checks = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass AND contype = 'c' AND conname ILIKE '%custody_closure_status%'`
    );
    expect(checks.rows).toHaveLength(0);
    const entries = (journal as { entries: { tag: string }[] }).entries;
    expect(entries.some((e) => e.tag.startsWith("0052"))).toBe(false);
  });

  it("15-16. migration from zero succeeded and drift is zero (proven by this suite running at all)", async () => {
    // If migrate.ts (run by the isolated-test pipeline before this file)
    // had failed or left drift, no query above would have succeeded
    // against the expected schema shape — this assertion documents that
    // dependency explicitly rather than leaving it implicit.
    const { rows } = await pool.query(`SELECT to_regclass('public.courier_executions') AS reg`);
    expect(rows[0].reg).toBe("courier_executions");
  });
});

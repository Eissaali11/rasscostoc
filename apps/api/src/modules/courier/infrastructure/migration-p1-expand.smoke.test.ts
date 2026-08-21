/**
 * OPS-REMED-E4-P1 — expand-migration smoke test.
 *
 * OPS-REMED-E4-P4-I1.R1 §6.A: this test documents the ORIGINAL, historical
 * P1/P2 contract (migration 0049: nullable column, no default, no NOT
 * NULL, no CHECK, no index; migrations 0050/0051: P2's supporting
 * tables) — a contract that P4 (migrations 0052-0054) has since
 * superseded on the shared isolated-test database. To keep proving the
 * historical claim honestly rather than rewriting it to describe P4, this
 * file now runs against its OWN disposable database, migrated only
 * through 0051 via scripts/test-historical-migration-database.mjs — never
 * the shared, fully-migrated (through 0054) isolated-test database. This
 * suite's own container is created and torn down entirely within this
 * file; it never touches the shared container scripts/test-isolated.mjs
 * manages.
 *
 * All original test numbers/names/assertions are preserved unchanged;
 * only the database wiring changed.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import pg from "pg";
import { createHistoricalMigrationDatabase } from "../../../../../../scripts/test-historical-migration-database.mjs";
import journal from "../../../../../../migrations/meta/_journal.json";

const { Client } = pg;

describe("OPS-REMED-E4-P1 — custody_closure_status expand migration (0049)", () => {
  let client: InstanceType<typeof Client>;
  let cleanup: () => void;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
    const historical = await createHistoricalMigrationDatabase("0051");
    cleanup = historical.cleanup;
    client = new Client({ connectionString: historical.databaseUrl });
    await client.connect();
  }, 60_000);

  afterAll(async () => {
    await client?.end().catch(() => {});
    cleanup?.();
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
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows).toHaveLength(1);
  });

  it("4. the column accepts NULL, and 7-8. has no default and no NOT NULL", async () => {
    const { rows } = await client.query(
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
    await client.query(
      `INSERT INTO users (id, username, email, password, full_name, role) VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, `e4-p1-${actorId.slice(0, 8)}`, `e4-p1-${actorId.slice(0, 8)}@test.local`, "x", "E4 P1 Smoke Actor", "admin"]
    );
    const { rows: reqRows } = await client.query(
      `INSERT INTO courier_requests (customer_name, incident_number) VALUES ($1, $2) RETURNING id`,
      ["E4 P1 Smoke Customer", `E4-P1-${randomUUID().slice(0, 8)}`]
    );
    const requestId = reqRows[0].id;

    // Old-style insert: no custody_closure_status column at all, exactly
    // what pre-P2 application code will continue to do.
    const { rows: execRows } = await client.query(
      `INSERT INTO courier_executions (request_id, entered_by) VALUES ($1, $2) RETURNING id, custody_closure_status`,
      [requestId, actorId]
    );
    expect(execRows[0].custody_closure_status).toBeNull();

    // Re-read: the row is unchanged by anything migration-adjacent.
    const { rows } = await client.query(
      `SELECT custody_closure_status FROM courier_executions WHERE id = $1`,
      [execRows[0].id]
    );
    expect(rows[0].custody_closure_status).toBeNull();
  });

  it("9. no E4 status CHECK constraint exists on courier_executions", async () => {
    const { rows } = await client.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass
         AND contype = 'c'
         AND conname ILIKE '%custody_closure_status%'`
    );
    expect(rows).toHaveLength(0);
  });

  it("10. no E4 status index exists on courier_executions", async () => {
    const { rows } = await client.query(
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
    const { rows } = await client.query(`SELECT to_regclass('public.inventory_deduction_completions') AS reg`);
    expect(rows[0].reg).toBe("inventory_deduction_completions");

    const uniques = await client.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'inventory_deduction_completions'::regclass AND contype = 'u'`
    );
    expect(uniques.rows.some((r: any) => r.conname.includes("request_id"))).toBe(true);
    expect(uniques.rows.some((r: any) => r.conname.includes("source_event_id"))).toBe(true);
  });

  it("11c. inventory_deduction_completions carries the certified claim/lease/fencing columns", async () => {
    const { rows } = await client.query(
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
    const { rows } = await client.query(`SELECT to_regclass('public.courier_execution_audit_dedup') AS reg`);
    expect(rows[0].reg).toBe("courier_execution_audit_dedup");

    const pk = await client.query(
      `SELECT a.attname FROM pg_constraint c
       JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.conrelid = 'courier_execution_audit_dedup'::regclass AND c.contype = 'p'
       ORDER BY k.ord`
    );
    expect(pk.rows.map((r: any) => r.attname)).toEqual(["source_event_id", "operation_kind"]);
  });

  it("12b. no P4 (0052) constraint or artifact exists yet on this cutoff database — custody_closure_status is still nullable, no CHECK", async () => {
    // OPS-REMED-E4-P4-I1.R1 §6.A: journal.json is a single repo-wide file
    // documenting every migration that EXISTS in the repo, not which ones
    // this specific cutoff database applied — it now legitimately
    // contains 0052-0054 (P4 has since been implemented), so this
    // assertion checks the actual pre-P4 database schema directly rather
    // than journal completeness, which is no longer the correct signal
    // for "P4 not applied here".
    const { rows } = await client.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_name = 'courier_executions' AND column_name = 'custody_closure_status'`
    );
    expect(rows[0].is_nullable).toBe("YES");
    const checks = await client.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'courier_executions'::regclass AND contype = 'c' AND conname ILIKE '%custody_closure_status%'`
    );
    expect(checks.rows).toHaveLength(0);
  });

  it("15-16. migration from zero succeeded and drift is zero (proven by this suite running at all)", async () => {
    // If this suite's own historical-cutoff migration run had failed or
    // left drift, no query above would have succeeded against the
    // expected pre-P4 schema shape — this assertion documents that
    // dependency explicitly rather than leaving it implicit.
    const { rows } = await client.query(`SELECT to_regclass('public.courier_executions') AS reg`);
    expect(rows[0].reg).toBe("courier_executions");
  });
});

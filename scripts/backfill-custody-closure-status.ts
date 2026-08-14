/**
 * OPS-REMED-E4-P2 — legacy backfill classifier for
 * courier_executions.custody_closure_status.
 *
 * Authored and tested in P2. NOT executed against any real, staging, or
 * production database by this gate — P3 alone authorizes real execution.
 *
 * Deterministic classification, per row:
 *   - all resolvable request items are DELIVERED       -> CLOSED_SUCCESS
 *   - none resolvable, clear failure evidence exists    -> FAILED_FINAL
 *   - none resolvable, zero evidence of any attempt      -> NOT_STARTED
 *   - some but not all DELIVERED / unresolved linkage     -> RECONCILIATION_REQUIRED
 *   - idempotency PROCESSING, no item evidence, stale (>155s) -> RECONCILIATION_REQUIRED
 *   - idempotency PROCESSING, no item evidence, still fresh -> left NULL this pass
 *
 * Bounded, resumable, deterministic, safe for repeated execution:
 *   - keyset batches (ORDER BY id), stabilization sweeps (not one forward
 *     pass — courier_executions.id is a Postgres `serial`, not guaranteed
 *     commit-ordered, so a single forward pass can skip a concurrently
 *     inserted lower id; repeated full sweeps close that gap).
 *   - single-runner enforced via a session-level advisory lock.
 *   - dry-run by default; --execute required to write.
 */
import "dotenv/config";
import { Pool } from "pg";
import { fileURLToPath } from "url";

export const BATCH_SIZE = 500;
export const MAX_STABILIZATION_SWEEPS = 5;
export const STALE_PROCESSING_MS = 155_000; // outbox retry ceiling, A.2/A.3 §6
const ADVISORY_LOCK_KEY = 872234501;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required (never read implicitly beyond this).");
  }
  return url;
}

function assertSafeTarget(url: string, executeFlag: boolean): void {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run: target database name "${dbName}" does not contain "test". ` +
        `This guard exists to prevent accidental execution against a non-test target — ` +
        `production/staging execution requires separate, explicit authorization (P3), never this script's own flags.`
    );
  }
  if (executeFlag) {
    console.log(`[backfill] Executing against test database "${dbName}".`);
  }
}

export type ClassificationCounts = {
  success: number;
  failedFinal: number;
  notStarted: number;
  reconciliationRequired: number;
  skippedActiveProcessing: number;
};

export async function classifyOneRow(
  pool: Pool,
  requestId: number
): Promise<{ status: string | null; reason: string }> {
  const itemsRes = await pool.query(
    `SELECT item_type, serial_number, sim_serial FROM courier_request_items
     WHERE request_id = $1 AND item_type IN ('POS','SIM')
       AND (serial_number IS NOT NULL OR sim_serial IS NOT NULL)`,
    [requestId]
  );

  // OPS-REMED-E4-P2-I.R3: compute staleness (age_ms) with a SQL expression
  // using the DATABASE's own now(), not by pulling created_at into JS and
  // diffing against Node's Date.now() — a `timestamp` (no timezone) column
  // round-tripped through node-postgres can be reinterpreted against the
  // Node process's local timezone, producing a large, fixed, spurious skew
  // whenever the Postgres server's session timezone differs from the
  // client's (confirmed empirically: a real disposable container showed a
  // 3-hour skew). Comparing both sides inside Postgres avoids that entirely.
  const idemRes = await pool.query(
    `SELECT status, EXTRACT(EPOCH FROM (now() - created_at)) * 1000 AS age_ms
     FROM idempotency_records
     WHERE idempotency_key LIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [`ExecutionCompletedEvent:REQ-${requestId}:InventorySubscriber:%`]
  );
  const idem = idemRes.rows[0] ?? null;

  const outboxRes = await pool.query(
    `SELECT status FROM outbox_events
     WHERE event_name = 'ExecutionCompletedEvent'
       AND payload->>'requestId' = $1
     ORDER BY created_at DESC LIMIT 1`,
    [String(requestId)]
  );
  const outbox = outboxRes.rows[0] ?? null;

  if (itemsRes.rows.length === 0) {
    if (outbox?.status === "DEAD" || idem?.status === "FAILED") {
      return { status: "FAILED_FINAL", reason: "no item evidence, clear failure evidence" };
    }
    if (idem?.status === "COMPLETED") {
      return { status: "CLOSED_SUCCESS", reason: "no item evidence, idempotency COMPLETED (defensive)" };
    }
    if (idem?.status === "PROCESSING") {
      const ageMs = Number(idem.age_ms);
      if (ageMs > STALE_PROCESSING_MS) {
        return { status: "RECONCILIATION_REQUIRED", reason: "stale PROCESSING, no item evidence" };
      }
      return { status: null, reason: "active PROCESSING — skip this pass" };
    }
    if (!idem && !outbox) {
      return { status: "NOT_STARTED", reason: "zero evidence of any attempt" };
    }
    return { status: "RECONCILIATION_REQUIRED", reason: "ambiguous fallback evidence" };
  }

  let unresolved = 0;
  let delivered = 0;
  for (const item of itemsRes.rows) {
    const serial = item.item_type === "POS" ? item.serial_number : item.sim_serial;
    const matchRes = await pool.query(
      `SELECT status FROM items WHERE serial_number = $1 OR barcode = $1 LIMIT 1`,
      [serial]
    );
    if (matchRes.rows.length === 0) {
      unresolved++;
    } else if (matchRes.rows[0].status === "DELIVERED") {
      delivered++;
    }
  }

  if (unresolved > 0) {
    return { status: "RECONCILIATION_REQUIRED", reason: "missing/ambiguous item linkage" };
  }
  if (delivered === itemsRes.rows.length) {
    return { status: "CLOSED_SUCCESS", reason: "all resolvable items DELIVERED" };
  }
  if (delivered === 0) {
    if (outbox?.status === "DEAD" || idem?.status === "FAILED") {
      return { status: "FAILED_FINAL", reason: "zero delivered, clear failure evidence" };
    }
    return { status: "NOT_STARTED", reason: "zero delivered, zero failure evidence" };
  }
  return { status: "RECONCILIATION_REQUIRED", reason: "partial delivery (legacy-only, should not occur post-E3)" };
}

export async function runSweep(pool: Pool, dryRun: boolean, counts: ClassificationCounts): Promise<number> {
  let lastId = 0;
  let totalClassified = 0;

  for (;;) {
    const batchRes = await pool.query(
      `SELECT id, request_id FROM courier_executions
       WHERE custody_closure_status IS NULL AND id > $1
       ORDER BY id LIMIT $2`,
      [lastId, BATCH_SIZE]
    );
    if (batchRes.rows.length === 0) break;

    for (const row of batchRes.rows) {
      lastId = row.id;
      const { status, reason } = await classifyOneRow(pool, row.request_id);
      if (status === null) {
        counts.skippedActiveProcessing++;
        continue;
      }
      console.log(`[backfill] execution ${row.id} (request ${row.request_id}) -> ${status} (${reason})`);
      if (status === "CLOSED_SUCCESS") counts.success++;
      else if (status === "FAILED_FINAL") counts.failedFinal++;
      else if (status === "NOT_STARTED") counts.notStarted++;
      else counts.reconciliationRequired++;

      if (!dryRun) {
        await pool.query(
          `UPDATE courier_executions SET custody_closure_status = $1 WHERE id = $2 AND custody_closure_status IS NULL`,
          [status, row.id]
        );
      }
      totalClassified++;
    }
  }
  return totalClassified;
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes("--execute");
  const url = resolveDatabaseUrl();
  assertSafeTarget(url, !dryRun);

  const pool = new Pool({ connectionString: url });
  const counts: ClassificationCounts = {
    success: 0,
    failedFinal: 0,
    notStarted: 0,
    reconciliationRequired: 0,
    skippedActiveProcessing: 0,
  };

  try {
    await pool.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    let sweep = 0;
    let remaining = 0;
    do {
      sweep++;
      console.log(`[backfill] Sweep ${sweep}/${MAX_STABILIZATION_SWEEPS} (dryRun=${dryRun})...`);
      await runSweep(pool, dryRun, counts);

      const remainingRes = await pool.query(
        `SELECT count(*)::int AS c FROM courier_executions WHERE custody_closure_status IS NULL`
      );
      remaining = remainingRes.rows[0].c;
      console.log(`[backfill] After sweep ${sweep}: ${remaining} row(s) still NULL.`);
    } while (remaining > 0 && sweep < MAX_STABILIZATION_SWEEPS);

    console.log("[backfill] Classification counts:", counts);
    console.log(`[backfill] Remaining NULL rows after ${sweep} sweep(s): ${remaining}`);

    if (remaining > 0) {
      console.error(`[backfill] FAILED — ${remaining} row(s) remain unclassified after max sweeps.`);
      process.exitCode = 1;
    } else {
      console.log("[backfill] Zero-NULL verification: PASS.");
    }
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    await pool.end();
  }
}

// Only run as a CLI entry point — importing this module from a test file
// (to exercise classifyOneRow/runSweep directly) must never trigger a
// real execution attempt.
const isDirectCliInvocation =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectCliInvocation) {
  main().catch((err) => {
    console.error("[backfill] Fatal error:", err);
    process.exitCode = 1;
  });
}

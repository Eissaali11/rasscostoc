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
 *   - zero evidence of any attempt (no linkage, no idempotency, no
 *     outbox row)                                        -> RECONCILIATION_REQUIRED
 *   - some but not all DELIVERED / unresolved linkage     -> RECONCILIATION_REQUIRED
 *   - idempotency PROCESSING, no item evidence, stale (>155s) -> RECONCILIATION_REQUIRED
 *   - idempotency PROCESSING, no item evidence, still fresh -> left NULL this pass
 *
 * OPS-REMED-E4-P3-A.2/I.R1: zero-evidence legacy rows are NOT classified
 * PENDING_DEDUCTION or NOT_STARTED. No durable ExecutionCompletedEvent
 * and no replay/retrigger mechanism exists for a legacy row with zero
 * evidence — nothing in the system will ever pick such a row up
 * automatically, so asserting "pending work" would be false. These rows
 * require explicit human reconciliation, same as any other unresolved
 * legacy evidence pattern. NOT_STARTED is not a member of the frozen
 * P2/P4 state model and is never written.
 *
 * Bounded, resumable, deterministic, safe for repeated execution:
 *   - keyset batches (ORDER BY id), stabilization sweeps (not one forward
 *     pass — courier_executions.id is a Postgres `serial`, not guaranteed
 *     commit-ordered, so a single forward pass can skip a concurrently
 *     inserted lower id; repeated full sweeps close that gap).
 *   - single-runner enforced via a session-level advisory lock.
 *   - dry-run by default; --execute required to write.
 *   - every non-dry-run write is a guarded compare-and-set
 *     (`WHERE ... AND custody_closure_status IS NULL`); a concurrent
 *     writer claiming the row first is detected via a zero-row UPDATE
 *     result and reported as `concurrentAnomalousSkip`, never silently
 *     treated as successful classification.
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
  reconciliationRequired: number;
  skippedActiveProcessing: number;
  // OPS-REMED-E4-P3-I.R1: a row whose guarded UPDATE affected zero rows —
  // a concurrent writer (a legitimate P2 transition) claimed it between
  // classification and this run's write. The CAS guard correctly
  // prevented an overwrite; this count reports the anomaly separately.
  // Never folded into `success`/`failedFinal`/`reconciliationRequired`.
  concurrentAnomalousSkip: number;
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
      return { status: "RECONCILIATION_REQUIRED", reason: "zero evidence of any attempt" };
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
    return { status: "RECONCILIATION_REQUIRED", reason: "zero delivered, zero failure evidence" };
  }
  return { status: "RECONCILIATION_REQUIRED", reason: "partial delivery (legacy-only, should not occur post-E3)" };
}

/**
 * OPS-REMED-E4-P3-I.R1: applies one row's classification via the guarded
 * compare-and-set UPDATE (`WHERE ... AND custody_closure_status IS NULL`)
 * and updates `counts` accordingly. Extracted from runSweep's loop body
 * so the guarded-write/concurrent-skip path can be exercised directly
 * against a real database in a regression test, without changing the
 * production call sequence in runSweep below (dry-run still counts
 * immediately; non-dry-run still writes then counts only on success).
 * Returns true if the row was classified (written, or dry-run), false if
 * a concurrent writer claimed the row first (concurrentAnomalousSkip).
 */
export async function applyGuardedClassification(
  pool: Pool,
  row: { id: number; request_id: number },
  status: string,
  dryRun: boolean,
  counts: ClassificationCounts
): Promise<boolean> {
  if (!dryRun) {
    // Guarded compare-and-set write. A zero-row result means a concurrent
    // writer (a legitimate P2 transition) claimed this row between
    // classification and this UPDATE — the IS NULL guard correctly
    // prevented an overwrite. This must be detected and reported as its
    // own anomaly, never silently counted as successful classification.
    const updateRes = await pool.query(
      `UPDATE courier_executions SET custody_closure_status = $1 WHERE id = $2 AND custody_closure_status IS NULL`,
      [status, row.id]
    );
    if ((updateRes.rowCount ?? 0) === 0) {
      console.warn(
        `[backfill] execution ${row.id} (request ${row.request_id}) -> CONCURRENT_ANOMALOUS_SKIP ` +
          `(status changed before guarded update; classification "${status}" discarded, not applied)`
      );
      counts.concurrentAnomalousSkip++;
      return false;
    }
  }

  if (status === "CLOSED_SUCCESS") counts.success++;
  else if (status === "FAILED_FINAL") counts.failedFinal++;
  else counts.reconciliationRequired++;

  return true;
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

      const written = await applyGuardedClassification(pool, row, status, dryRun, counts);
      if (written) totalClassified++;
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
    reconciliationRequired: 0,
    skippedActiveProcessing: 0,
    concurrentAnomalousSkip: 0,
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

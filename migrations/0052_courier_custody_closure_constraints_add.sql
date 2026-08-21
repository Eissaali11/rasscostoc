-- OPS-REMED-E4-P4-I1 — staged constraint migration, file 1 of 3.
--
-- Adds two CHECK constraints as NOT VALID: metadata-only, near-instant,
-- does not scan or lock existing rows against their values. Existing rows
-- are NOT verified by this migration; verification happens in 0053.
--
-- 1) courier_executions_custody_closure_status_not_null_check — a CHECK
--    (col IS NOT NULL), added as a stepping-stone so the later
--    ALTER COLUMN ... SET NOT NULL in 0054 can skip its own full-table
--    scan (Postgres recognizes an already-VALIDATED CHECK (col IS NOT
--    NULL) constraint as proof and skips re-verifying it).
-- 2) courier_executions_custody_closure_status_check — the allowed-value
--    set, frozen from merged executable code (OPS-REMED-E4-P4-D1 §5):
--    every writer across courier.service.ts (initial insert),
--    inventory.subscriber.ts, CourierProjectionWorker.ts,
--    courier-saga.subscriber.ts, and the legacy backfill script
--    (backfill-custody-closure-status.ts) writes only these six values.
--
-- Preconditions before this file may be applied to any real target:
-- E4-P3's backfill must have already run there and proven zero remaining
-- NULL rows for pre-P2-era data — this migration does not itself run or
-- depend on the backfill; it only adds constraints, which will simply
-- fail to VALIDATE (in 0053) if any NULL or out-of-set value remains.
--
-- Rollback (safe at any point before 0053/0054 apply):
--   ALTER TABLE "courier_executions"
--     DROP CONSTRAINT IF EXISTS "courier_executions_custody_closure_status_not_null_check";
--   ALTER TABLE "courier_executions"
--     DROP CONSTRAINT IF EXISTS "courier_executions_custody_closure_status_check";
ALTER TABLE "courier_executions"
  ADD CONSTRAINT "courier_executions_custody_closure_status_not_null_check"
  CHECK ("custody_closure_status" IS NOT NULL) NOT VALID;

ALTER TABLE "courier_executions"
  ADD CONSTRAINT "courier_executions_custody_closure_status_check"
  CHECK ("custody_closure_status" IN (
    'PENDING_DEDUCTION',
    'PROCESSING',
    'CLOSED_SUCCESS',
    'FAILED_RETRYABLE',
    'FAILED_FINAL',
    'RECONCILIATION_REQUIRED'
  )) NOT VALID;

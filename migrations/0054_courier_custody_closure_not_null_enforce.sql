-- OPS-REMED-E4-P4-I1 — staged constraint migration, file 3 of 3 (final).
--
-- Promotes custody_closure_status to a real NOT NULL column. Because the
-- CHECK (custody_closure_status IS NOT NULL) constraint added in 0052 was
-- already validated in 0053, Postgres (12+) recognizes it as sufficient
-- proof and skips its own full-table re-verification scan for this
-- ALTER COLUMN — this is the entire point of staging across three files.
--
-- The stepping-stone NOT-NULL check constraint is then redundant (the
-- column's own NOT NULL now enforces it identically and is reflected in
-- information_schema) and is dropped for schema cleanliness. The
-- allowed-value CHECK constraint (courier_executions_custody_closure_status_check)
-- is kept permanently — it is the P4 deliverable itself.
--
-- This file completes the custody-closure section of the roadmap
-- engineering-wise. It does NOT itself perform any real-target backfill
-- or activation — applying this migration file to any real database is
-- a separate, explicitly-authorized Production Certification step, not
-- implied by this migration existing in the repository.
--
-- Rollback:
--   ALTER TABLE "courier_executions" ALTER COLUMN "custody_closure_status" DROP NOT NULL;
--   (the allowed-value CHECK constraint would need to be dropped too if a
--   full rollback to the pre-P4 shape is required)
ALTER TABLE "courier_executions"
  ALTER COLUMN "custody_closure_status" SET NOT NULL;

ALTER TABLE "courier_executions"
  DROP CONSTRAINT "courier_executions_custody_closure_status_not_null_check";

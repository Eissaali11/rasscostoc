-- OPS-REMED-E4-P4-I1 — staged constraint migration, file 2 of 3.
--
-- Validates the two NOT VALID constraints added in 0052 against existing
-- rows. VALIDATE CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock —
-- it blocks concurrent DDL on this table but does NOT block concurrent
-- reads or writes, unlike a combined ADD CONSTRAINT (which would take
-- ACCESS EXCLUSIVE for the full scan).
--
-- On any real target: if E4-P3's backfill has not actually run there, or
-- left any row NULL or holding a value outside the frozen set, this
-- migration will fail with a constraint-violation error and roll back
-- (each migration file is its own transaction per scripts/migrate.ts) —
-- it will not partially apply or corrupt data.
--
-- Rollback (safe — VALIDATE has no undo, but the constraints themselves
-- remain droppable, which also un-validates them):
--   ALTER TABLE "courier_executions"
--     DROP CONSTRAINT IF EXISTS "courier_executions_custody_closure_status_not_null_check";
--   ALTER TABLE "courier_executions"
--     DROP CONSTRAINT IF EXISTS "courier_executions_custody_closure_status_check";
ALTER TABLE "courier_executions"
  VALIDATE CONSTRAINT "courier_executions_custody_closure_status_not_null_check";

ALTER TABLE "courier_executions"
  VALIDATE CONSTRAINT "courier_executions_custody_closure_status_check";

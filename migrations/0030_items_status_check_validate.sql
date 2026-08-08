-- DB-R2 (Phase C4.5B, part 2 of 2) — validate the items.status legal-value
-- guard added as NOT VALID in 0029.
--
-- VALIDATE CONSTRAINT scans existing rows to confirm they all satisfy the
-- constraint, using a lock weaker than ACCESS EXCLUSIVE (SHARE UPDATE
-- EXCLUSIVE) for the scan itself -- normal reads and writes are not
-- blocked while it runs. This must be deployed as a separate migration
-- run from 0029 on any database with existing rows, so that the brief
-- ACCESS EXCLUSIVE lock taken in 0029 is fully released and committed
-- before this scan begins.
--
-- If any existing row's status is not one of the six legal values, this
-- statement fails loudly and the constraint remains NOT VALID -- it does
-- not delete, rewrite, or normalize any row. That would be a separate,
-- explicitly authorized data-remediation decision (see Phase C4.5A's
-- production precheck design), never an automatic side effect of this
-- migration.
ALTER TABLE "items"
  VALIDATE CONSTRAINT "items_status_legal_check";

-- DB-R2 (Phase C4.5B, part 1 of 2) — items.status legal-value guard.
--
-- Adds a CHECK constraint restricting items.status to the six values
-- actually written by any active code path today (traced exhaustively in
-- Phase C4.5A/C4.5A.1 across apps/api/src AND packages/shared-types):
--   WAREHOUSE, IN_TRANSIT_CUSTODY, RECEIVED_BY_TECHNICIAN, IN_TRANSIT,
--   DELIVERED, RETURNED.
-- PENDING_ACCEPTANCE is deliberately excluded: it appears only in a
-- declared-but-never-imported TypeScript contract (ITEM_STATUSES /
-- itemStatusSchema in packages/shared-types/schemas/serialized_items.schema.ts)
-- and one defensive read-side `case` — zero write paths produce it.
--
-- NOT VALID here does not mean lock-free: PostgreSQL still takes a brief
-- ACCESS EXCLUSIVE lock while registering the constraint. What NOT VALID
-- buys is skipping the full-table scan that would otherwise happen inside
-- that same lock -- new/changed rows are checked immediately, existing
-- rows are left unchecked until a separate VALIDATE CONSTRAINT is run.
--
-- This migration and the next one (0030) are deliberately split into two
-- files so that -- when deployed as two separate migration runs (two
-- separate releases), not two files applied in the same pass -- each one
-- executes inside its own transaction. Drizzle's node-postgres migrator
-- wraps every *pending* migration file in a single outer transaction per
-- run, so if 0029 and 0030 are both still pending in the same run they
-- will execute in that one transaction (harmless on an empty/fresh test
-- database, which is what CI always runs against). On a real database
-- with existing rows, this migration must be deployed and applied on its
-- own first; 0030 is a separate, later deployment.
ALTER TABLE "items"
  ADD CONSTRAINT "items_status_legal_check"
  CHECK (status IN (
    'WAREHOUSE',
    'IN_TRANSIT_CUSTODY',
    'RECEIVED_BY_TECHNICIAN',
    'IN_TRANSIT',
    'DELIVERED',
    'RETURNED'
  )) NOT VALID;

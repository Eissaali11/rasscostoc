-- DB-R1 / Phase C4.6C.3 — CHECK constraints for technician_moving_
-- inventory_entries current-balance columns (Bucket-C-adjacent side
-- finding from Phase C4.6C.1/C4.6C.2).
--
-- Scope (traced and semantically reconfirmed in Phase C4.6C.3):
--   technician_moving_inventory_entries.boxes  -- current technician
--     inventory balance; the C4.6C.2 atomic withdrawal fix already
--     rejects any withdrawal that would drive this negative (checked
--     against the LOCKED balance before writing); custody-engine.ts
--     independently clamps deltas with Math.max(0, ...). No active
--     legitimate write path was found that produces a negative value.
--   technician_moving_inventory_entries.units  -- same semantics.
--
-- This matches exactly the pattern already remediated for the sibling
-- legacy table technicians_inventory in Phase C4.6B.1 (migrations
-- 0031/0032): 0 = legal, positive = legal, negative = illegal.
--
-- Explicitly OUT of scope for this migration (see C4.6C.3 directive):
--   warehouse_inventory / warehouse_inventory_entries,
--   technician_fixed_inventories / technician_fixed_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   All prior DB-R1 slices (C4.6B.1-5, C4.6C.2, already fixed and merged)
--   The C4.6C.2 shared-transaction/locking concurrency fix itself,
--     which this migration does not modify.
--
-- NULL policy is unchanged. Both target columns are already NOT NULL
-- with a DEFAULT of 0; no NOT NULL/DEFAULT/TYPE change is made here.
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0042), matching the C4.6B.1-5/C4.6C.2/DB-R2 precedent.

ALTER TABLE "technician_moving_inventory_entries"
  ADD CONSTRAINT "technician_moving_inventory_entries_boxes_nonnegative_check"
  CHECK (boxes >= 0) NOT VALID;

ALTER TABLE "technician_moving_inventory_entries"
  ADD CONSTRAINT "technician_moving_inventory_entries_units_nonnegative_check"
  CHECK (units >= 0) NOT VALID;

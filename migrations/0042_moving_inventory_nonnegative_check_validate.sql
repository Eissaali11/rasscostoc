-- DB-R1 / Phase C4.6C.3 — validation phase for the moving inventory
-- nonnegative CHECK constraints added in 0041, applied in a genuinely
-- separate transaction/deployment (see 0041's header and the
-- C4.6B.1-5/C4.6C.2/DB-R2 precedent). VALIDATE CONSTRAINT takes only a
-- SHARE UPDATE EXCLUSIVE lock and scans existing rows; it does not
-- mutate any data. If any existing row violates a constraint, this
-- statement fails safely and the constraint stays unvalidated -- no
-- automatic cleanup/normalization is performed here.

ALTER TABLE "technician_moving_inventory_entries"
  VALIDATE CONSTRAINT "technician_moving_inventory_entries_boxes_nonnegative_check";

ALTER TABLE "technician_moving_inventory_entries"
  VALIDATE CONSTRAINT "technician_moving_inventory_entries_units_nonnegative_check";

-- DB-R1 / Phase C4.6B.2 — validation phase for the positive CHECK
-- constraints added in 0033, applied in a genuinely separate transaction/
-- deployment (see 0033's header and the DB-R1/DB-R2 precedent, migrations
-- 0029/0030, 0031/0032). VALIDATE CONSTRAINT takes only a SHARE UPDATE
-- EXCLUSIVE lock and scans existing rows; it does not mutate any data. If
-- any existing row violates a constraint, this statement fails safely and
-- the constraint stays unvalidated -- no automatic cleanup/normalization is
-- performed here.

ALTER TABLE "transactions"
  VALIDATE CONSTRAINT "transactions_quantity_positive_check";

ALTER TABLE "stock_movements"
  VALIDATE CONSTRAINT "stock_movements_quantity_positive_check";

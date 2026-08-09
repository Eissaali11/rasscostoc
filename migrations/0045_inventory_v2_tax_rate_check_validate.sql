-- DB-R10C.3 — validation phase for the canonical tax-rate CHECK
-- constraint added in 0044, applied as a genuinely separate
-- transaction/deployment (see 0044's header and the DB-R1 precedent).
-- VALIDATE CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock and
-- scans existing rows; it does not mutate any data. If any existing row
-- violates the constraint, this statement fails safely and the
-- constraint stays unvalidated — no automatic cleanup is performed here.

ALTER TABLE "products"
  VALIDATE CONSTRAINT "products_default_tax_rate_canonical_fraction_check";

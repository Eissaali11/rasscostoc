-- DB-R1 / Phase C4.6B.5 — validation phase for the
-- technician_sales_metrics_daily quantity CHECK constraints added in
-- 0039, applied in a genuinely separate transaction/deployment (see
-- 0039's header and the C4.6B.1/B.2/B.3/B.4/DB-R2 precedent). VALIDATE
-- CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock and scans existing
-- rows; it does not mutate any data. If any existing row violates a
-- constraint, this statement fails safely and the constraint stays
-- unvalidated -- no automatic cleanup/normalization is performed here.

ALTER TABLE "technician_sales_metrics_daily"
  VALIDATE CONSTRAINT "technician_sales_metrics_daily_sold_qty_nonnegative_check";

ALTER TABLE "technician_sales_metrics_daily"
  VALIDATE CONSTRAINT "technician_sales_metrics_daily_returns_qty_nonnegative_check";

ALTER TABLE "technician_sales_metrics_daily"
  VALIDATE CONSTRAINT "technician_sales_metrics_daily_remaining_qty_nonnegative_check";

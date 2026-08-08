-- DB-R1 / Phase C4.6B.5 — CHECK constraints for
-- technician_sales_metrics_daily quantity fields (final ready-Bucket-A
-- slice).
--
-- Scope (traced and semantically classified in Phase C4.6A / C4.6B.5A /
-- C4.6B.5), all three >= 0:
--
--   sold_qty  -- daily aggregate of sales_invoice_lines.qty from posted
--     STANDARD invoices only (AccountingService.postSalesInvoice); the
--     credit-note reversal path (createSalesCreditNote) never reaches
--     this aggregation -- confirmed live in C4.6B.5A.
--   remaining_qty_end_of_day  -- MAX(sales_invoice_lines.qty_after_sale)
--     for the posted invoice; qty_after_sale is already DB-constrained
--     >= 0 since C4.6B.4 (sales_invoice_lines_qty_after_sale_nonnegative_check).
--   returns_qty  -- intended daily returns quantity; confirmed (C4.6B.5A)
--     to have no active update path beyond the literal 0 written at
--     initial INSERT (the ON CONFLICT DO UPDATE clause in
--     AccountingService.postSalesInvoice omits it entirely). The
--     constraint is semantically correct and never conflicts with the
--     only value ever written. The incomplete aggregation itself is
--     recorded as a separate, non-blocking functional finding -- NOT
--     fixed by this migration.
--
-- Explicitly OUT of scope for this migration (see C4.6B.5 directive):
--   sold_amount, avg_selling_price (financial, deferred to DB-R10)
--   All prior DB-R1 slices (C4.6B.1/B.2/B.3/B.4, already fixed)
--   technician_fixed_inventories / technician_fixed_inventory_entries,
--   warehouse_inventory / warehouse_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   technician_moving_inventory_entries
--     (Bucket C — confirmed-live lost-update concurrency finding, unfixed)
--
-- NULL policy is unchanged. All three target columns are already NOT
-- NULL with DEFAULT 0; no NOT NULL/DEFAULT/TYPE change is made here.
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0040), matching the C4.6B.1/B.2/B.3/B.4/DB-R2 precedent.

ALTER TABLE "technician_sales_metrics_daily"
  ADD CONSTRAINT "technician_sales_metrics_daily_sold_qty_nonnegative_check"
  CHECK (sold_qty >= 0) NOT VALID;

ALTER TABLE "technician_sales_metrics_daily"
  ADD CONSTRAINT "technician_sales_metrics_daily_returns_qty_nonnegative_check"
  CHECK (returns_qty >= 0) NOT VALID;

ALTER TABLE "technician_sales_metrics_daily"
  ADD CONSTRAINT "technician_sales_metrics_daily_remaining_qty_nonnegative_check"
  CHECK (remaining_qty_end_of_day >= 0) NOT VALID;

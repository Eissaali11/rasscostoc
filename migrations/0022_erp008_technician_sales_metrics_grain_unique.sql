-- ERP-008-P2.2: enforce daily metrics grain for atomic upsert
-- Conflict target in accounting.service.ts postSalesInvoice:
--   ON CONFLICT (sales_date, technician_id, item_type_id, region_id)
-- item_type_id / region_id are nullable; default UNIQUE treats NULLs as distinct and
-- would NOT upsert null-grain rows. NULLS NOT DISTINCT matches aggregation intent
-- (NULL region / NULL item = one daily bucket per technician).
-- Requires PostgreSQL 15+.
-- Rollback:
--   ALTER TABLE "technician_sales_metrics_daily"
--     DROP CONSTRAINT "technician_sales_metrics_daily_grain_unique";
ALTER TABLE "technician_sales_metrics_daily"
  ADD CONSTRAINT "technician_sales_metrics_daily_grain_unique"
  UNIQUE NULLS NOT DISTINCT ("sales_date", "technician_id", "item_type_id", "region_id");

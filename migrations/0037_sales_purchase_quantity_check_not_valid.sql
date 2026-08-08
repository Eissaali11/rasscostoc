-- DB-R1 / Phase C4.6B.4 — CHECK constraints for sales order / sales
-- invoice line quantity fields (remaining Bucket A slice).
--
-- Scope (traced and semantically classified in Phase C4.6A / C4.6B.4):
--   sales_order_items.quantity            -- > 0; requested order
--     quantity, no legitimate zero/negative write path found
--   sales_invoice_lines.qtyBeforeSale      -- >= 0; nonnegative
--     inventory-balance snapshot, app layer already enforces
--     z.number().nonnegative() (accounting.routes.ts)
--   sales_invoice_lines.qtyAfterSale       -- >= 0; same as above
--
-- IMPORTANT — deliberately EXCLUDED from this migration on governance STOP
-- grounds (Phase C4.6B.4 Step 8, semantics reconfirmation):
--   sales_invoice_lines.qty
--   purchase_bill_lines.qty
-- Both columns have a confirmed-live, active business write path
-- (AccountingService.createSalesCreditNote / createPurchaseDebitNote,
-- apps/api/src/modules/accounting/infrastructure/accounting.service.ts)
-- that intentionally INSERTs a negative qty (`-Math.abs(line.qty)`) to
-- represent a credit-note / debit-note reversal line. This is a real,
-- current ZATCA-related accounting feature, not dead code. A positive-only
-- (or even nonnegative-only) CHECK constraint on either column would break
-- that feature outright, so neither column is touched here. Reconciling
-- this will require a separate design decision (e.g. a signed-quantity
-- model, or a dedicated reversal/original-line linkage) and is out of
-- scope for a database-only remediation round.
--
-- Explicitly OUT of scope for other reasons (see C4.6B.4 directive):
--   technician_sales_metrics_daily.* (deferred to a later slice)
--   All prior DB-R1 slices (C4.6B.1/B.2/B.3, already fixed)
--   technician_fixed_inventories / technician_fixed_inventory_entries,
--   warehouse_inventory / warehouse_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   technician_moving_inventory_entries
--     (Bucket C — confirmed-live lost-update concurrency finding, unfixed)
--   Any financial/monetary column (amount, price, unitPrice, lineTotal,
--     subtotal, grandTotal, discount, tax*, etc. — deferred to DB-R10)
--
-- NULL policy is unchanged. sales_invoice_lines.qtyBeforeSale/qtyAfterSale
-- are nullable with no DEFAULT; CHECK constraints pass on NULL in
-- Postgres, so no NOT NULL/DEFAULT/TYPE change is made here.
-- sales_order_items.quantity is already NOT NULL.
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0038), matching the C4.6B.1/C4.6B.2/C4.6B.3/DB-R2 precedent.

ALTER TABLE "sales_order_items"
  ADD CONSTRAINT "sales_order_items_quantity_positive_check"
  CHECK (quantity > 0) NOT VALID;

ALTER TABLE "sales_invoice_lines"
  ADD CONSTRAINT "sales_invoice_lines_qty_before_sale_nonnegative_check"
  CHECK (qty_before_sale >= 0) NOT VALID;

ALTER TABLE "sales_invoice_lines"
  ADD CONSTRAINT "sales_invoice_lines_qty_after_sale_nonnegative_check"
  CHECK (qty_after_sale >= 0) NOT VALID;

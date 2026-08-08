-- DB-R1 / Phase C4.6B.4 — validation phase for the sales order/invoice
-- quantity CHECK constraints added in 0037, applied in a genuinely
-- separate transaction/deployment (see 0037's header and the
-- C4.6B.1/C4.6B.2/C4.6B.3/DB-R2 precedent). VALIDATE CONSTRAINT takes only
-- a SHARE UPDATE EXCLUSIVE lock and scans existing rows; it does not
-- mutate any data. If any existing row violates a constraint, this
-- statement fails safely and the constraint stays unvalidated -- no
-- automatic cleanup/normalization is performed here.

ALTER TABLE "sales_order_items"
  VALIDATE CONSTRAINT "sales_order_items_quantity_positive_check";

ALTER TABLE "sales_invoice_lines"
  VALIDATE CONSTRAINT "sales_invoice_lines_qty_before_sale_nonnegative_check";

ALTER TABLE "sales_invoice_lines"
  VALIDATE CONSTRAINT "sales_invoice_lines_qty_after_sale_nonnegative_check";

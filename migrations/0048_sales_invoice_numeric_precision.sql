-- DB-R10C.5b — sales invoice financial precision. Converts the 8
-- authorized fields from doublePrecision (float8) to guarded exact
-- NUMERIC storage:
--
--   sales_invoices.subtotal          -> NUMERIC(14,2)
--   sales_invoices.discount_total    -> NUMERIC(14,2)
--   sales_invoices.taxable_amount    -> NUMERIC(14,2)
--   sales_invoices.vat_total         -> NUMERIC(14,2)
--   sales_invoices.grand_total       -> NUMERIC(14,2)
--   sales_invoice_lines.unit_price   -> NUMERIC(14,4)
--   sales_invoice_lines.discount     -> NUMERIC(14,2)
--   sales_invoice_lines.line_total   -> NUMERIC(14,2)
--
-- unit_price is NUMERIC(14,4), not (14,2): the existing certified test
-- suite (round2ActivePaths.p_dbR10c1.test.ts) proves the current write
-- path already accepts and persists unit prices with up to 4 meaningful
-- decimal digits (e.g. 12184.515 rounds to 3, and the column itself has
-- no scale restriction as float8) — forcing 2 decimals here would change
-- existing accepted business behavior. This governance decision was made
-- explicitly for DB-R10C.5b and does not apply to any other slice.
--
-- No other accounting column is touched in this slice — not qty,
-- qtyBeforeSale/qtyAfterSale (Category D, out of scope), not purchase
-- bills, payments, tax_transactions, taxCodes.rate, or technician sales
-- metrics (deferred to C.5c-C.5g).
--
-- FAILS CLOSED: this entire migration runs as a single transaction. Any
-- guard below that finds an unsafe row raises an exception, which aborts
-- the whole migration (including every ALTER already issued in this
-- file) — no partial DB-R10C.5b state is ever left committed, and no row
-- is ever silently rounded, truncated, or deleted to force success.
--
-- Same PostgreSQL-specific correctness notes verified for DB-R10C.3/.4P
-- apply unchanged here (PostgreSQL float8 NaN = NaN is TRUE, so NaN
-- cannot be detected via self-comparison; NaN::float8 casts silently
-- into numeric without erroring, so every guard below tests
-- `= 'NaN'::float8` explicitly before any ALTER TYPE runs).
--
-- Production has not been inspected (no read-only production DB identity
-- exists) — every guard below is defensive against arbitrary existing
-- row content, not tuned to any known dataset.

-- ============================================================
-- STEP 1 — finite-value / scale-preservation / capacity guards
-- ============================================================

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- sales_invoices.{subtotal,discount_total,taxable_amount,vat_total,grand_total}
  -- -> NUMERIC(14,2): 12 integer digits capacity.
  SELECT count(*) INTO bad_count FROM sales_invoices
  WHERE subtotal = 'NaN'::float8 OR subtotal = 'Infinity'::float8 OR subtotal = '-Infinity'::float8
     OR abs(subtotal) >= 1000000000000::float8
     OR subtotal::text::numeric <> round(subtotal::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoices.subtotal are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_invoices
  WHERE discount_total = 'NaN'::float8 OR discount_total = 'Infinity'::float8 OR discount_total = '-Infinity'::float8
     OR abs(discount_total) >= 1000000000000::float8
     OR discount_total::text::numeric <> round(discount_total::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoices.discount_total are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_invoices
  WHERE taxable_amount = 'NaN'::float8 OR taxable_amount = 'Infinity'::float8 OR taxable_amount = '-Infinity'::float8
     OR abs(taxable_amount) >= 1000000000000::float8
     OR taxable_amount::text::numeric <> round(taxable_amount::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoices.taxable_amount are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_invoices
  WHERE vat_total = 'NaN'::float8 OR vat_total = 'Infinity'::float8 OR vat_total = '-Infinity'::float8
     OR abs(vat_total) >= 1000000000000::float8
     OR vat_total::text::numeric <> round(vat_total::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoices.vat_total are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_invoices
  WHERE grand_total = 'NaN'::float8 OR grand_total = 'Infinity'::float8 OR grand_total = '-Infinity'::float8
     OR abs(grand_total) >= 1000000000000::float8
     OR grand_total::text::numeric <> round(grand_total::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoices.grand_total are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- sales_invoice_lines.unit_price -> NUMERIC(14,4): 10 integer digits capacity.
  SELECT count(*) INTO bad_count FROM sales_invoice_lines
  WHERE unit_price = 'NaN'::float8 OR unit_price = 'Infinity'::float8 OR unit_price = '-Infinity'::float8
     OR abs(unit_price) >= 10000000000::float8
     OR unit_price::text::numeric <> round(unit_price::text::numeric, 4);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoice_lines.unit_price are non-finite, exceed NUMERIC(14,4) capacity, or carry more than 4 fractional digits of precision', bad_count;
  END IF;

  -- sales_invoice_lines.{discount,line_total} -> NUMERIC(14,2)
  SELECT count(*) INTO bad_count FROM sales_invoice_lines
  WHERE discount = 'NaN'::float8 OR discount = 'Infinity'::float8 OR discount = '-Infinity'::float8
     OR abs(discount) >= 1000000000000::float8
     OR discount::text::numeric <> round(discount::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoice_lines.discount are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_invoice_lines
  WHERE line_total = 'NaN'::float8 OR line_total = 'Infinity'::float8 OR line_total = '-Infinity'::float8
     OR abs(line_total) >= 1000000000000::float8
     OR line_total::text::numeric <> round(line_total::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.5b BLOCKED: % row(s) in sales_invoice_lines.line_total are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;
END $$;

-- ============================================================
-- STEP 2 — column type conversion (guards above already passed)
-- ============================================================

-- Exact cast via text (avoids any binary float rounding at the
-- boundary — same text-mediated cast pattern proven safe in
-- DB-R10C.3/.4P).
ALTER TABLE "sales_invoices"
  ALTER COLUMN "subtotal" TYPE numeric(14, 2)
  USING subtotal::text::numeric(14, 2);
ALTER TABLE "sales_invoices"
  ALTER COLUMN "subtotal" SET DEFAULT 0;

ALTER TABLE "sales_invoices"
  ALTER COLUMN "discount_total" TYPE numeric(14, 2)
  USING discount_total::text::numeric(14, 2);
ALTER TABLE "sales_invoices"
  ALTER COLUMN "discount_total" SET DEFAULT 0;

ALTER TABLE "sales_invoices"
  ALTER COLUMN "taxable_amount" TYPE numeric(14, 2)
  USING taxable_amount::text::numeric(14, 2);
ALTER TABLE "sales_invoices"
  ALTER COLUMN "taxable_amount" SET DEFAULT 0;

ALTER TABLE "sales_invoices"
  ALTER COLUMN "vat_total" TYPE numeric(14, 2)
  USING vat_total::text::numeric(14, 2);
ALTER TABLE "sales_invoices"
  ALTER COLUMN "vat_total" SET DEFAULT 0;

ALTER TABLE "sales_invoices"
  ALTER COLUMN "grand_total" TYPE numeric(14, 2)
  USING grand_total::text::numeric(14, 2);
ALTER TABLE "sales_invoices"
  ALTER COLUMN "grand_total" SET DEFAULT 0;

ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "unit_price" TYPE numeric(14, 4)
  USING unit_price::text::numeric(14, 4);
ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "unit_price" SET DEFAULT 0;

ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "discount" TYPE numeric(14, 2)
  USING discount::text::numeric(14, 2);
ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "discount" SET DEFAULT 0;

ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "line_total" TYPE numeric(14, 2)
  USING line_total::text::numeric(14, 2);
ALTER TABLE "sales_invoice_lines"
  ALTER COLUMN "line_total" SET DEFAULT 0;

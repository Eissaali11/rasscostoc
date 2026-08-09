-- DB-R10C.3 — convert the 7 authorized inventory_v2 financial columns
-- from doublePrecision (float8) to guarded exact NUMERIC storage:
--
--   products.default_price          -> NUMERIC(14,4)
--   products.default_tax_rate       -> NUMERIC(5,4)  (canonical fraction)
--   sales_orders.amount_before_tax  -> NUMERIC(14,2)
--   sales_orders.tax_amount         -> NUMERIC(14,2)
--   sales_orders.total_amount       -> NUMERIC(14,2)
--   sales_order_items.unit_price    -> NUMERIC(14,4)
--   sales_order_items.line_tax_amount -> NUMERIC(14,2)
--
-- FAILS CLOSED: this entire migration runs as a single transaction. Any
-- guard below that finds an unsafe row raises an exception, which aborts
-- the whole migration (including every ALTER already issued in this
-- file) — no partial DB-R10C.3 state is ever left committed, and no row
-- is ever silently rounded, truncated, or deleted to force success.
--
-- PostgreSQL-specific correctness notes (verified live against
-- PostgreSQL 16 before writing this migration):
--   1. Unlike IEEE-754, PostgreSQL defines float8 NaN = NaN as TRUE, so
--      a NaN value cannot be detected with `x <> x` / `NOT (x = x)` —
--      every guard below tests `x = 'NaN'::float8` explicitly instead.
--   2. `NaN::float8` casts SILENTLY into any numeric(p,s) column as NaN
--      (no overflow error) — so relying on the ALTER TYPE ... USING
--      cast alone would let NaN rows through undetected. This is why
--      every guard explicitly rejects NaN before any ALTER TYPE runs.
--   3. `Infinity::float8` DOES fail a scaled numeric(p,s) cast on its
--      own ("numeric field overflow"), but is still checked explicitly
--      here for a clear, attributable error message rather than a raw
--      Postgres overflow error on an arbitrary row.
--
-- Production data has not been inspected (no read-only production DB
-- identity exists) — every guard below is defensive against arbitrary
-- existing row content, not tuned to any known dataset.

-- ============================================================
-- STEP 1 — finite-value / scale-preservation / capacity guards
-- ============================================================

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- products.default_price -> NUMERIC(14,4): 10 integer digits capacity.
  SELECT count(*) INTO bad_count FROM products
  WHERE default_price = 'NaN'::float8
     OR default_price = 'Infinity'::float8
     OR default_price = '-Infinity'::float8
     OR abs(default_price) >= 10000000000::float8
     OR default_price::text::numeric <> round(default_price::text::numeric, 4);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in products.default_price are non-finite, exceed NUMERIC(14,4) capacity, or carry more than 4 fractional digits of precision', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- products.default_tax_rate: classify using the SAME range logic as
  -- classifyLegacyTaxRate() (DB-R10C.1): canonical fractional [0,1], or
  -- legacy percentage-points (1,100]. Anything else is
  -- INVALID_OR_AMBIGUOUS and blocks the migration.
  SELECT count(*) INTO bad_count FROM products
  WHERE default_tax_rate = 'NaN'::float8
     OR default_tax_rate = 'Infinity'::float8
     OR default_tax_rate = '-Infinity'::float8
     OR default_tax_rate < 0
     OR default_tax_rate > 100;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in products.default_tax_rate are non-finite or outside the classifiable range [0,100] (see classifyLegacyTaxRate semantics)', bad_count;
  END IF;

  -- After normalization (legacy percentage-points -> fractional, value
  -- > 1 implies legacy, divide by 100), the fractional part must fit
  -- within 4 decimal digits without further rounding.
  SELECT count(*) INTO bad_count FROM products
  WHERE (
    CASE WHEN default_tax_rate > 1 THEN (default_tax_rate::text::numeric / 100) ELSE default_tax_rate::text::numeric END
  ) <> round(
    CASE WHEN default_tax_rate > 1 THEN (default_tax_rate::text::numeric / 100) ELSE default_tax_rate::text::numeric END,
    4
  );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in products.default_tax_rate would lose precision when normalized to canonical fractional NUMERIC(5,4)', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- sales_orders.amount_before_tax / tax_amount / total_amount ->
  -- NUMERIC(14,2): 12 integer digits capacity.
  SELECT count(*) INTO bad_count FROM sales_orders
  WHERE amount_before_tax = 'NaN'::float8 OR amount_before_tax = 'Infinity'::float8 OR amount_before_tax = '-Infinity'::float8
     OR abs(amount_before_tax) >= 1000000000000::float8
     OR amount_before_tax::text::numeric <> round(amount_before_tax::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in sales_orders.amount_before_tax are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_orders
  WHERE tax_amount = 'NaN'::float8 OR tax_amount = 'Infinity'::float8 OR tax_amount = '-Infinity'::float8
     OR abs(tax_amount) >= 1000000000000::float8
     OR tax_amount::text::numeric <> round(tax_amount::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in sales_orders.tax_amount are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_orders
  WHERE total_amount = 'NaN'::float8 OR total_amount = 'Infinity'::float8 OR total_amount = '-Infinity'::float8
     OR abs(total_amount) >= 1000000000000::float8
     OR total_amount::text::numeric <> round(total_amount::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in sales_orders.total_amount are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- sales_order_items.unit_price -> NUMERIC(14,4); line_tax_amount -> NUMERIC(14,2)
  SELECT count(*) INTO bad_count FROM sales_order_items
  WHERE unit_price = 'NaN'::float8 OR unit_price = 'Infinity'::float8 OR unit_price = '-Infinity'::float8
     OR abs(unit_price) >= 10000000000::float8
     OR unit_price::text::numeric <> round(unit_price::text::numeric, 4);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in sales_order_items.unit_price are non-finite, exceed NUMERIC(14,4) capacity, or carry unsupported precision', bad_count;
  END IF;

  SELECT count(*) INTO bad_count FROM sales_order_items
  WHERE line_tax_amount = 'NaN'::float8 OR line_tax_amount = 'Infinity'::float8 OR line_tax_amount = '-Infinity'::float8
     OR abs(line_tax_amount) >= 1000000000000::float8
     OR line_tax_amount::text::numeric <> round(line_tax_amount::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.3 BLOCKED: % row(s) in sales_order_items.line_tax_amount are non-finite, exceed NUMERIC(14,2) capacity, or carry unsupported precision', bad_count;
  END IF;
END $$;

-- ============================================================
-- STEP 2 — column type conversion (guards above already passed)
-- ============================================================

-- products.default_price: exact cast via text (avoids any binary
-- float rounding at the boundary — see DB-R10B.1 §11 evidence that
-- PostgreSQL's float8->numeric direct cast can differ subtly from a
-- text-mediated cast for edge values; text-mediation is the safer,
-- explicit choice).
ALTER TABLE "products"
  ALTER COLUMN "default_price" TYPE numeric(14, 4)
  USING default_price::text::numeric(14, 4);
ALTER TABLE "products"
  ALTER COLUMN "default_price" SET DEFAULT 0;

-- products.default_tax_rate: normalize legacy percentage-points (>1)
-- to canonical fractional form during the same cast; drop the old
-- doublePrecision default (15.0) before altering type, then set the
-- new canonical default (0.1500) after.
ALTER TABLE "products"
  ALTER COLUMN "default_tax_rate" DROP DEFAULT;
ALTER TABLE "products"
  ALTER COLUMN "default_tax_rate" TYPE numeric(5, 4)
  USING (
    CASE WHEN default_tax_rate > 1
      THEN (default_tax_rate::text::numeric / 100)
      ELSE default_tax_rate::text::numeric
    END
  )::numeric(5, 4);
ALTER TABLE "products"
  ALTER COLUMN "default_tax_rate" SET DEFAULT 0.1500;

ALTER TABLE "sales_orders"
  ALTER COLUMN "amount_before_tax" TYPE numeric(14, 2)
  USING amount_before_tax::text::numeric(14, 2);
ALTER TABLE "sales_orders"
  ALTER COLUMN "amount_before_tax" SET DEFAULT 0;

ALTER TABLE "sales_orders"
  ALTER COLUMN "tax_amount" TYPE numeric(14, 2)
  USING tax_amount::text::numeric(14, 2);
ALTER TABLE "sales_orders"
  ALTER COLUMN "tax_amount" SET DEFAULT 0;

ALTER TABLE "sales_orders"
  ALTER COLUMN "total_amount" TYPE numeric(14, 2)
  USING total_amount::text::numeric(14, 2);
ALTER TABLE "sales_orders"
  ALTER COLUMN "total_amount" SET DEFAULT 0;

ALTER TABLE "sales_order_items"
  ALTER COLUMN "unit_price" TYPE numeric(14, 4)
  USING unit_price::text::numeric(14, 4);

ALTER TABLE "sales_order_items"
  ALTER COLUMN "line_tax_amount" TYPE numeric(14, 2)
  USING line_tax_amount::text::numeric(14, 2);

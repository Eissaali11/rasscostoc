-- DB-R10C.4P — journal-line exact numeric prerequisite for the future
-- DB-R10C.4 database journal-balance invariant. Converts ONLY:
--
--   journal_entry_lines.debit   -> NUMERIC(14,2)
--   journal_entry_lines.credit  -> NUMERIC(14,2)
--
-- from doublePrecision (float8). No other accounting column (including
-- journal_entries.exchange_rate) is touched in this slice — this is a
-- narrow prerequisite, not the start of a broad accounting-numeric
-- migration. The balance-enforcing constraint trigger itself is NOT part
-- of this migration; it is deferred to the resumed DB-R10C.4.
--
-- FAILS CLOSED: this entire migration runs as a single transaction. Any
-- guard below that finds an unsafe row raises an exception, which aborts
-- the whole migration — no partial state is ever left committed, and no
-- row is ever silently rounded, truncated, or deleted to force success.
--
-- Same PostgreSQL-specific correctness notes verified for DB-R10C.3 apply
-- unchanged here (PostgreSQL float8 NaN = NaN is TRUE, so NaN cannot be
-- detected via self-comparison; NaN::float8 casts silently into numeric
-- without erroring, so every guard below tests `= 'NaN'::float8`
-- explicitly before any ALTER TYPE runs).
--
-- Production has not been inspected (no read-only production DB identity
-- exists) — every guard below is defensive against arbitrary existing row
-- content, not tuned to any known dataset.

-- ============================================================
-- STEP 1 — finite-value / scale-preservation / capacity guards
-- ============================================================

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- journal_entry_lines.debit -> NUMERIC(14,2): 12 integer digits capacity.
  SELECT count(*) INTO bad_count FROM journal_entry_lines
  WHERE debit = 'NaN'::float8
     OR debit = 'Infinity'::float8
     OR debit = '-Infinity'::float8
     OR abs(debit) >= 1000000000000::float8
     OR debit::text::numeric <> round(debit::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.4P BLOCKED: % row(s) in journal_entry_lines.debit are non-finite, exceed NUMERIC(14,2) capacity, or carry more than 2 fractional digits of precision', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  -- journal_entry_lines.credit -> NUMERIC(14,2): 12 integer digits capacity.
  SELECT count(*) INTO bad_count FROM journal_entry_lines
  WHERE credit = 'NaN'::float8
     OR credit = 'Infinity'::float8
     OR credit = '-Infinity'::float8
     OR abs(credit) >= 1000000000000::float8
     OR credit::text::numeric <> round(credit::text::numeric, 2);
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.4P BLOCKED: % row(s) in journal_entry_lines.credit are non-finite, exceed NUMERIC(14,2) capacity, or carry more than 2 fractional digits of precision', bad_count;
  END IF;
END $$;

-- ============================================================
-- STEP 2 — column type conversion (guards above already passed)
-- ============================================================

-- Exact cast via text (avoids any binary float rounding at the boundary
-- — same text-mediated cast pattern proven safe in DB-R10C.3).
ALTER TABLE "journal_entry_lines"
  ALTER COLUMN "debit" TYPE numeric(14, 2)
  USING debit::text::numeric(14, 2);
ALTER TABLE "journal_entry_lines"
  ALTER COLUMN "debit" SET DEFAULT 0;

ALTER TABLE "journal_entry_lines"
  ALTER COLUMN "credit" TYPE numeric(14, 2)
  USING credit::text::numeric(14, 2);
ALTER TABLE "journal_entry_lines"
  ALTER COLUMN "credit" SET DEFAULT 0;

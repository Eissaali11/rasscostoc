-- DB-R10C.4 (resumed) — database-enforced journal balance invariant.
--
-- Rule: a journal_entries row whose status = 'posted' must, at
-- TRANSACTION COMMIT, satisfy:
--
--   SUM(journal_entry_lines.debit) = SUM(journal_entry_lines.credit)
--   AND NOT (both sums are zero)
--
-- using PostgreSQL exact NUMERIC(14,2) arithmetic — no float, no
-- epsilon, no application-level tolerance. This mirrors the existing
-- proven application semantics in accounting.service.ts:
--   - postJournalEntry() rejects totalDebit === totalCredit === 0
--     ("posting an entry with no lines") and rejects any imbalance
--     beyond a float-noise-driven 0.009 tolerance band — the DB
--     invariant below replaces that tolerance with exact equality.
--   - every auto-posting flow (sales invoice, sales credit note,
--     purchase bill, purchase debit note, payment) INSERTs the parent
--     journal_entries row with status='posted' BEFORE its lines exist,
--     then inserts lines in subsequent statements in the SAME
--     transaction — so the invariant MUST be deferred to commit, not
--     checked per-statement, or every one of those flows would break.
--
-- Confirmed from current source (post DB-R10C.4P merge):
--   - journal_entry_lines.entry_id is NEVER UPDATEd anywhere in the
--     current application code (no reparenting exists in current
--     business paths). It is, however, DB-mutable (no immutability
--     constraint on the column) — a raw UPDATE of entry_id remains
--     physically possible, so the invariant below still defends both
--     the OLD and NEW parent journal for that case rather than
--     assuming the application-level behavior as a DB guarantee.
--   - journal_entry_lines is never DELETEd via application code; only
--     an ON DELETE CASCADE FK exists at the DB level if a parent
--     journal_entries row itself were deleted (also not exercised by
--     current application code, but defended below).
--
-- CONCURRENCY DESIGN (revised after an experimentally-reproduced
-- lock-upgrade deadlock in an earlier version of this migration):
--   PostgreSQL's own FK-existence check on every INSERT/UPDATE of
--   journal_entry_lines implicitly acquires a FOR KEY SHARE lock on
--   the referenced journal_entries row. A design that only takes an
--   exclusive lock on the parent LATE (inside the deferred, pre-commit
--   validation) causes two concurrent transactions that each already
--   hold that implicit FOR KEY SHARE lock to deadlock when both try to
--   upgrade to an exclusive lock at commit time — this was proven
--   live (two individually-valid concurrent line-writers on the same
--   journal reliably hit "deadlock detected").
--
--   Fix, proven experimentally against PostgreSQL 16 before being
--   written into this migration: acquire an EARLY, non-deferred
--   `FOR NO KEY UPDATE` lock on the affected parent journal(s) in a
--   plain BEFORE trigger, before the line INSERT/UPDATE/DELETE (and
--   therefore before PostgreSQL's own FK check) ever runs.
--   `FOR NO KEY UPDATE` was chosen over `FOR UPDATE` because it is the
--   weakest lock mode that still conflicts with itself (so two
--   concurrent line-writers on the same journal still serialize
--   correctly) while remaining compatible with the FK check's
--   `FOR KEY SHARE` (so it never needs to escalate past another
--   transaction's already-held weaker lock). The later deferred
--   validator reuses the same `FOR NO KEY UPDATE` mode for the same
--   reason — no lock escalation anywhere in this design.
--
--   When a line UPDATE moves entry_id between two different journals
--   (DB-mutable, not currently exercised by the application), both the
--   early lock and the deferred validation lock the OLD and NEW parent
--   in deterministic ascending-id order to prevent an opposite-order
--   deadlock between two such cross-journal movers.
--
-- FAILS CLOSED, EXISTING DATA: before installing any function or
-- trigger, this migration scans EVERY existing posted journal and
-- aborts the whole migration (no partial install) if any already-
-- invalid posted journal is found. Production has not been inspected
-- (no read-only production DB identity exists) — this precheck is
-- defensive against arbitrary existing data, not tuned to a known
-- dataset. No repair, rounding, or reclassification of any kind is
-- ever performed.

-- ============================================================
-- STEP 1 — existing-data precheck (fails closed, no repair)
-- ============================================================

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count FROM (
    SELECT je.id
    FROM journal_entries je
    LEFT JOIN journal_entry_lines jel ON jel.entry_id = je.id
    WHERE je.status = 'posted'
    GROUP BY je.id
    HAVING COALESCE(SUM(jel.debit), 0) <> COALESCE(SUM(jel.credit), 0)
        OR (COALESCE(SUM(jel.debit), 0) = 0 AND COALESCE(SUM(jel.credit), 0) = 0)
  ) invalid_posted;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'DB-R10C.4 BLOCKED: % existing posted journal_entries row(s) violate the balance invariant (SUM(debit) <> SUM(credit), or both are zero). No automatic repair is performed — this requires a separate governance decision before the invariant can be enabled.', bad_count;
  END IF;
END $$;

-- ============================================================
-- STEP 2 — lock helper (deterministic order for two distinct parents)
-- ============================================================

CREATE OR REPLACE FUNCTION lock_journal_parents_early(p_id1 varchar, p_id2 varchar)
RETURNS void AS $$
DECLARE
  v_first varchar;
  v_second varchar;
BEGIN
  IF p_id2 IS NULL OR p_id1 = p_id2 THEN
    PERFORM 1 FROM journal_entries WHERE id = p_id1 FOR NO KEY UPDATE;
    RETURN;
  END IF;

  IF p_id1 < p_id2 THEN
    v_first := p_id1; v_second := p_id2;
  ELSE
    v_first := p_id2; v_second := p_id1;
  END IF;

  PERFORM 1 FROM journal_entries WHERE id = v_first FOR NO KEY UPDATE;
  PERFORM 1 FROM journal_entries WHERE id = v_second FOR NO KEY UPDATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 3 — validation function (validation only; never mutates data)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_journal_balance(p_entry_id varchar)
RETURNS void AS $$
DECLARE
  v_status text;
  v_total_debit numeric(14,2);
  v_total_credit numeric(14,2);
BEGIN
  -- Same lock mode as the early trigger (FOR NO KEY UPDATE) — already
  -- held by this transaction from the early BEFORE trigger, so this is
  -- a cheap re-acquisition, not an escalation. Re-taken here (rather
  -- than relying purely on the early lock) so this function remains
  -- correct even if ever called from a context that skipped the early
  -- trigger.
  SELECT status INTO v_status
  FROM journal_entries
  WHERE id = p_entry_id
  FOR NO KEY UPDATE;

  -- Parent already gone (e.g. cascade-deleted mid-transaction) —
  -- nothing to validate.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Drafts are intentionally unconstrained by this invariant — the
  -- existing proven semantics allow a draft to remain unbalanced
  -- indefinitely.
  IF v_status <> 'posted' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
  FROM journal_entry_lines
  WHERE entry_id = p_entry_id;

  IF v_total_debit = 0 AND v_total_credit = 0 THEN
    RAISE EXCEPTION 'DB-R10C.4 VIOLATION: posted journal_entries.id=% has zero total debit and zero total credit (no valid lines)', p_entry_id;
  END IF;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'DB-R10C.4 VIOLATION: posted journal_entries.id=% is unbalanced (total_debit=%, total_credit=%)', p_entry_id, v_total_debit, v_total_credit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 4 — trigger functions
-- ============================================================

-- EARLY, non-deferred serialization trigger. Fires immediately (not at
-- commit) on every line mutation, before PostgreSQL's own FK check for
-- that statement runs, and before any deferred validation. Locks the
-- affected parent(s) with FOR NO KEY UPDATE in deterministic order.
CREATE OR REPLACE FUNCTION trg_lock_journal_line_parent_early()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM lock_journal_parents_early(OLD.entry_id, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM lock_journal_parents_early(OLD.entry_id, NEW.entry_id);
    RETURN NEW;
  ELSE
    PERFORM lock_journal_parents_early(NEW.entry_id, NULL);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Deferred validation trigger. Fires on line mutation, at commit.
-- Validates the affected journal(s) — for UPDATE, both OLD and NEW
-- parent if they differ (DB-mutable entry_id case), in the same
-- deterministic order as the early lock.
CREATE OR REPLACE FUNCTION trg_validate_journal_line_balance()
RETURNS trigger AS $$
DECLARE
  v_first varchar;
  v_second varchar;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM validate_journal_balance(OLD.entry_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.entry_id IS DISTINCT FROM OLD.entry_id THEN
      IF OLD.entry_id < NEW.entry_id THEN
        v_first := OLD.entry_id; v_second := NEW.entry_id;
      ELSE
        v_first := NEW.entry_id; v_second := OLD.entry_id;
      END IF;
      PERFORM validate_journal_balance(v_first);
      PERFORM validate_journal_balance(v_second);
    ELSE
      PERFORM validate_journal_balance(NEW.entry_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM validate_journal_balance(NEW.entry_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fires on the parent row itself (both early-lock-equivalent and
-- deferred-validate, since a normal non-deferred BEFORE trigger on the
-- parent row already implicitly holds the row's own lock via the
-- UPDATE/INSERT machinery — no separate early-lock function is needed
-- here). Required because every auto-posting flow inserts
-- journal_entries with status='posted' BEFORE any line exists, and a
-- manual draft->posted UPDATE never touches journal_entry_lines at
-- all. Without this trigger, a posted journal that (incorrectly) never
-- gets any lines in the same transaction would never be validated by
-- the line-table trigger above.
CREATE OR REPLACE FUNCTION trg_validate_journal_entry_balance()
RETURNS trigger AS $$
BEGIN
  PERFORM validate_journal_balance(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 5 — triggers: one early (non-deferred) + two deferred
-- ============================================================

CREATE TRIGGER journal_entry_lines_lock_early
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION trg_lock_journal_line_parent_early();

CREATE CONSTRAINT TRIGGER journal_entry_lines_balance_check
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_journal_line_balance();

CREATE CONSTRAINT TRIGGER journal_entries_balance_check
  AFTER INSERT OR UPDATE OF status ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_journal_entry_balance();

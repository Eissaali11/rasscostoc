-- DB-R10C.3 — database-level enforcement of the canonical fractional
-- tax-rate invariant (0.1500 = 15%), following the same NOT VALID /
-- VALIDATE CONSTRAINT zero-downtime pattern established in DB-R1
-- (see migrations 0029-0042). NOT VALID adds the constraint immediately
-- without scanning/locking existing rows for validation; migration 0045
-- performs the actual validation in a separate deployment step.
--
-- By the time this migration runs, 0043 has already converted and
-- normalized every existing row into [0,1], so this constraint is
-- expected to validate cleanly — it exists as a permanent database
-- invariant, not merely a one-time migration guard.

ALTER TABLE "products"
  ADD CONSTRAINT "products_default_tax_rate_canonical_fraction_check"
  CHECK ("default_tax_rate" >= 0 AND "default_tax_rate" <= 1) NOT VALID;

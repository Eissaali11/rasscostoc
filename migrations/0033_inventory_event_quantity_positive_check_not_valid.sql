-- DB-R1 / Phase C4.6B.2 — positive CHECK constraints for INVENTORY EVENT
-- quantity fields (Bucket A, "event quantities" slice).
--
-- Scope (traced and semantically classified in Phase C4.6A / C4.6B.2):
--   transactions.quantity      -- event quantity; direction carried
--                                  separately in transactions.type
--   stock_movements.quantity   -- event quantity; direction carried
--                                  separately in from_inventory/to_inventory
--
-- Explicitly OUT of scope for this migration (see C4.6B.2 directive):
--   inventory_items.quantity, technician_product_stock.quantity,
--     technicians_inventory.* (already fixed, Phase C4.6B.1, migrations
--     0031/0032)
--   technician_fixed_inventories / technician_fixed_inventory_entries,
--   warehouse_inventory / warehouse_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   technician_moving_inventory_entries
--     (Bucket C — confirmed-live lost-update concurrency finding, unfixed)
--   Any financial/monetary column (deferred to DB-R10)
--
-- Semantics: an event quantity is a magnitude, not a signed delta -- zero
-- and negative are illegal for both columns, only positive is legal. NULL
-- policy is unchanged by this migration (both target columns are already
-- NOT NULL; no NOT NULL/DEFAULT/TYPE change is made here).
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0034), matching the DB-R1/DB-R2 precedent: ADD CONSTRAINT ... NOT VALID
-- still takes a brief ACCESS EXCLUSIVE lock but skips the full-table scan;
-- the scan happens later, in its own transaction/deployment, via
-- VALIDATE CONSTRAINT (SHARE UPDATE EXCLUSIVE lock only). No data is
-- read, mutated, or normalized by either file.

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_quantity_positive_check"
  CHECK (quantity > 0) NOT VALID;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_positive_check"
  CHECK (quantity > 0) NOT VALID;

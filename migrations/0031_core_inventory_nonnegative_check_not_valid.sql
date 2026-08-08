-- DB-R1 / Phase C4.6B.1 — nonnegative CHECK constraints for CURRENT INVENTORY
-- STATE fields only (Bucket A, "core inventory balances" slice).
--
-- Scope (traced and semantically classified in Phase C4.6A / C4.6A.2):
--   inventory_items.quantity          -- legacy current-stock balance
--   technicians_inventory.*           -- legacy per-technician current
--                                         balance, 10 product boxes/units pairs
--   technician_product_stock.quantity -- current per-product technician stock
--
-- Explicitly OUT of scope for this migration (see C4.6B.1 directive):
--   transactions.quantity, stock_movements.quantity (event quantities, > 0,
--     deferred to a later slice)
--   technician_fixed_inventories / technician_fixed_inventory_entries,
--   warehouse_inventory / warehouse_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   technician_moving_inventory_entries
--     (Bucket C — confirmed-live lost-update concurrency finding, unfixed)
--   Any financial/monetary column (deferred to DB-R10)
--
-- Semantics: 0 = legal, positive = legal, negative = illegal. NULL policy is
-- unchanged by this migration (all target columns are already NOT NULL with
-- a default of 0 — verified against information_schema before writing this
-- file; no NOT NULL/DEFAULT/TYPE change is made here).
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0032), matching the DB-R2 precedent: ADD CONSTRAINT ... NOT VALID still
-- takes a brief ACCESS EXCLUSIVE lock but skips the full-table scan; the
-- scan happens later, in its own transaction/deployment, via
-- VALIDATE CONSTRAINT (SHARE UPDATE EXCLUSIVE lock only). No data is
-- read, mutated, or normalized by either file.

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_quantity_nonnegative_check"
  CHECK (quantity >= 0) NOT VALID;

ALTER TABLE "technician_product_stock"
  ADD CONSTRAINT "technician_product_stock_quantity_nonnegative_check"
  CHECK (quantity >= 0) NOT VALID;

ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_n950_boxes_nonnegative_check"
  CHECK (n950_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_n950_units_nonnegative_check"
  CHECK (n950_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_i9000s_boxes_nonnegative_check"
  CHECK (i9000s_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_i9000s_units_nonnegative_check"
  CHECK (i9000s_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_i9100_boxes_nonnegative_check"
  CHECK (i9100_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_i9100_units_nonnegative_check"
  CHECK (i9100_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_roll_paper_boxes_nonnegative_check"
  CHECK (roll_paper_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_roll_paper_units_nonnegative_check"
  CHECK (roll_paper_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_stickers_boxes_nonnegative_check"
  CHECK (stickers_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_stickers_units_nonnegative_check"
  CHECK (stickers_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_new_batteries_boxes_nonnegative_check"
  CHECK (new_batteries_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_new_batteries_units_nonnegative_check"
  CHECK (new_batteries_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_mobily_sim_boxes_nonnegative_check"
  CHECK (mobily_sim_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_mobily_sim_units_nonnegative_check"
  CHECK (mobily_sim_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_stc_sim_boxes_nonnegative_check"
  CHECK (stc_sim_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_stc_sim_units_nonnegative_check"
  CHECK (stc_sim_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_zain_sim_boxes_nonnegative_check"
  CHECK (zain_sim_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_zain_sim_units_nonnegative_check"
  CHECK (zain_sim_units >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_lebara_boxes_nonnegative_check"
  CHECK (lebara_boxes >= 0) NOT VALID;
ALTER TABLE "technicians_inventory"
  ADD CONSTRAINT "technicians_inventory_lebara_units_nonnegative_check"
  CHECK (lebara_units >= 0) NOT VALID;

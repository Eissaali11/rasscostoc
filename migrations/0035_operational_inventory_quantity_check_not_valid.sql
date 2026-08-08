-- DB-R1 / Phase C4.6B.3 — CHECK constraints for OPERATIONAL INVENTORY
-- quantity fields (remaining Bucket A slice).
--
-- Scope (traced and semantically classified in Phase C4.6A / C4.6B.3),
-- two families:
--
--   Family A (> 0 -- zero and negative illegal):
--     warehouse_transfers.quantity  -- app layer already enforces
--       z.number().positive() (stock-transfer.routes.ts)
--     courier_request_items.quantity  -- defaults to 1, no legitimate
--       zero/negative write path found
--     item_types.unitsPerBox  -- domain entity (item-type.entity.ts)
--       already throws InvalidItemTypeError for <= 0; Zod schemas already
--       require .positive()
--
--   Family B (>= 0 -- negative illegal, zero legal / "not used"):
--     courier_executions.paperRollQty / stickersQty / nulipCardsQty  --
--       explicitly defaulted to 0 when the consumable wasn't used
--       (inventory.subscriber.ts)
--     inventory_requests.* -- 10 product boxes/units pairs, same
--       column set and semantics as technicians_inventory (C4.6B.1)
--
-- Explicitly OUT of scope for this migration (see C4.6B.3 directive):
--   sales_invoice_lines.*, purchase_bill_lines.*, sales_order_items.*,
--     technician_sales_metrics_daily.* (deferred to a later slice)
--   inventory_items.quantity, technician_product_stock.quantity,
--     technicians_inventory.* (already fixed, C4.6B.1)
--   transactions.quantity, stock_movements.quantity (already fixed,
--     C4.6B.2)
--   technician_fixed_inventories / technician_fixed_inventory_entries,
--   warehouse_inventory / warehouse_inventory_entries
--     (Bucket B — architecturally blocked, dual-representation finding open)
--   technician_moving_inventory_entries
--     (Bucket C — confirmed-live lost-update concurrency finding, unfixed)
--   Any financial/monetary column (deferred to DB-R10)
--
-- NULL policy is unchanged by this migration. inventory_requests.* and
-- courier_executions.*Qty columns are nullable with DEFAULT 0 already;
-- CHECK constraints pass on NULL in Postgres, so no NOT NULL/DEFAULT/TYPE
-- change is made here for those. warehouse_transfers.quantity,
-- courier_request_items.quantity, and item_types.unitsPerBox are already
-- NOT NULL.
--
-- Split into NOT VALID (this file) + a separate VALIDATE CONSTRAINT file
-- (0036), matching the C4.6B.1/C4.6B.2/DB-R2 precedent.

ALTER TABLE "warehouse_transfers"
  ADD CONSTRAINT "warehouse_transfers_quantity_positive_check"
  CHECK (quantity > 0) NOT VALID;

ALTER TABLE "courier_request_items"
  ADD CONSTRAINT "courier_request_items_quantity_positive_check"
  CHECK (quantity > 0) NOT VALID;

ALTER TABLE "item_types"
  ADD CONSTRAINT "item_types_units_per_box_positive_check"
  CHECK (units_per_box > 0) NOT VALID;

ALTER TABLE "courier_executions"
  ADD CONSTRAINT "courier_executions_paper_roll_qty_nonnegative_check"
  CHECK (paper_roll_qty >= 0) NOT VALID;
ALTER TABLE "courier_executions"
  ADD CONSTRAINT "courier_executions_stickers_qty_nonnegative_check"
  CHECK (stickers_qty >= 0) NOT VALID;
ALTER TABLE "courier_executions"
  ADD CONSTRAINT "courier_executions_nulip_cards_qty_nonnegative_check"
  CHECK (nulip_cards_qty >= 0) NOT VALID;

ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_n950_boxes_nonnegative_check"
  CHECK (n950_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_n950_units_nonnegative_check"
  CHECK (n950_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_i9000s_boxes_nonnegative_check"
  CHECK (i9000s_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_i9000s_units_nonnegative_check"
  CHECK (i9000s_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_i9100_boxes_nonnegative_check"
  CHECK (i9100_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_i9100_units_nonnegative_check"
  CHECK (i9100_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_roll_paper_boxes_nonnegative_check"
  CHECK (roll_paper_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_roll_paper_units_nonnegative_check"
  CHECK (roll_paper_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_stickers_boxes_nonnegative_check"
  CHECK (stickers_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_stickers_units_nonnegative_check"
  CHECK (stickers_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_new_batteries_boxes_nonnegative_check"
  CHECK (new_batteries_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_new_batteries_units_nonnegative_check"
  CHECK (new_batteries_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_mobily_sim_boxes_nonnegative_check"
  CHECK (mobily_sim_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_mobily_sim_units_nonnegative_check"
  CHECK (mobily_sim_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_stc_sim_boxes_nonnegative_check"
  CHECK (stc_sim_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_stc_sim_units_nonnegative_check"
  CHECK (stc_sim_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_zain_sim_boxes_nonnegative_check"
  CHECK (zain_sim_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_zain_sim_units_nonnegative_check"
  CHECK (zain_sim_units >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_lebara_boxes_nonnegative_check"
  CHECK (lebara_boxes >= 0) NOT VALID;
ALTER TABLE "inventory_requests"
  ADD CONSTRAINT "inventory_requests_lebara_units_nonnegative_check"
  CHECK (lebara_units >= 0) NOT VALID;

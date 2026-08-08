-- DB-R1 / Phase C4.6B.3 — validation phase for the operational inventory
-- quantity CHECK constraints added in 0035, applied in a genuinely
-- separate transaction/deployment (see 0035's header and the C4.6B.1/
-- C4.6B.2/DB-R2 precedent). VALIDATE CONSTRAINT takes only a SHARE UPDATE
-- EXCLUSIVE lock and scans existing rows; it does not mutate any data. If
-- any existing row violates a constraint, this statement fails safely and
-- the constraint stays unvalidated -- no automatic cleanup/normalization is
-- performed here.

ALTER TABLE "warehouse_transfers"
  VALIDATE CONSTRAINT "warehouse_transfers_quantity_positive_check";

ALTER TABLE "courier_request_items"
  VALIDATE CONSTRAINT "courier_request_items_quantity_positive_check";

ALTER TABLE "item_types"
  VALIDATE CONSTRAINT "item_types_units_per_box_positive_check";

ALTER TABLE "courier_executions"
  VALIDATE CONSTRAINT "courier_executions_paper_roll_qty_nonnegative_check";
ALTER TABLE "courier_executions"
  VALIDATE CONSTRAINT "courier_executions_stickers_qty_nonnegative_check";
ALTER TABLE "courier_executions"
  VALIDATE CONSTRAINT "courier_executions_nulip_cards_qty_nonnegative_check";

ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_n950_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_n950_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_i9000s_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_i9000s_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_i9100_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_i9100_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_roll_paper_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_roll_paper_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_stickers_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_stickers_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_new_batteries_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_new_batteries_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_mobily_sim_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_mobily_sim_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_stc_sim_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_stc_sim_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_zain_sim_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_zain_sim_units_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_lebara_boxes_nonnegative_check";
ALTER TABLE "inventory_requests"
  VALIDATE CONSTRAINT "inventory_requests_lebara_units_nonnegative_check";

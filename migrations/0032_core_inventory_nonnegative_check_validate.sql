-- DB-R1 / Phase C4.6B.1 — validation phase for the nonnegative CHECK
-- constraints added in 0031, applied in a genuinely separate transaction/
-- deployment (see 0031's header and the DB-R2 precedent, migrations
-- 0029/0030). VALIDATE CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock
-- and scans existing rows; it does not mutate any data. If any existing row
-- violates a constraint, this statement fails safely and the constraint
-- stays unvalidated -- no automatic cleanup/normalization is performed here.

ALTER TABLE "inventory_items"
  VALIDATE CONSTRAINT "inventory_items_quantity_nonnegative_check";

ALTER TABLE "technician_product_stock"
  VALIDATE CONSTRAINT "technician_product_stock_quantity_nonnegative_check";

ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_n950_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_n950_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_i9000s_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_i9000s_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_i9100_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_i9100_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_roll_paper_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_roll_paper_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_stickers_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_stickers_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_new_batteries_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_new_batteries_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_mobily_sim_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_mobily_sim_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_stc_sim_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_stc_sim_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_zain_sim_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_zain_sim_units_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_lebara_boxes_nonnegative_check";
ALTER TABLE "technicians_inventory"
  VALIDATE CONSTRAINT "technicians_inventory_lebara_units_nonnegative_check";

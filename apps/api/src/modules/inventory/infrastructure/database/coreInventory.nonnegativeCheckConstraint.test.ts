/**
 * DB-R1 regression — Phase C4.6B.1 — nonnegative CHECK constraints for
 * CURRENT INVENTORY STATE fields.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R2/DB-R7/DB-R8/DB-R9 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R1, confirmed live in
 * Phase C4.6A): several current-inventory-balance columns accepted negative
 * integers with no rejection, because their sole protection was
 * application-layer logic.
 *
 * Fix (migrations/0031 + 0032): CHECK (... >= 0) constraints restricting
 * these columns to the semantics actually intended -- 0 and positive values
 * legal, negative illegal -- for exactly the fields classified "Bucket A /
 * ready" in Phase C4.6A.2:
 *   inventory_items.quantity
 *   technician_product_stock.quantity
 *   technicians_inventory.* (10 product boxes/units pairs)
 *
 * Explicitly NOT covered here (different buckets, different governance
 * rounds): transactions.quantity / stock_movements.quantity (event
 * quantities), technician_fixed_inventories / *_entries and
 * warehouse_inventory / *_entries (Bucket B, architecturally blocked),
 * technician_moving_inventory_entries (Bucket C, open concurrency finding).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { inventoryItems, technicianProductStock, techniciansInventory, users, products } from "@shared/schema";

describe("DB-R1 — core inventory nonnegative CHECK constraints (Phase C4.6B.1)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdInventoryItemIds: string[] = [];
  const createdStockIds: string[] = [];
  const createdTechInventoryIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  afterEach(async () => {
    for (const id of createdInventoryItemIds.splice(0)) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).catch(() => {});
    }
    for (const id of createdStockIds.splice(0)) {
      await db.delete(technicianProductStock).where(eq(technicianProductStock.id, id)).catch(() => {});
    }
    for (const id of createdTechInventoryIds.splice(0)) {
      await db.delete(techniciansInventory).where(eq(techniciansInventory.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
    for (const id of createdProductIds.splice(0)) {
      await db.delete(products).where(eq(products.id, id)).catch(() => {});
    }
  });

  async function seedTechnicianAndProduct() {
    const technicianId = randomUUID();
    await db.insert(users).values({
      id: technicianId,
      username: `dbr1-${technicianId.slice(0, 8)}`,
      email: `dbr1-${technicianId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 Technician",
      role: "technician",
    });
    createdUserIds.push(technicianId);

    const productId = randomUUID();
    await db.insert(products).values({
      id: productId,
      productCode: `DBR1-${productId.slice(0, 8)}`,
      barcode: `DBR1-BAR-${productId.slice(0, 8)}`,
      nameAr: "منتج",
      nameEn: "Product",
    });
    createdProductIds.push(productId);

    return { technicianId, productId };
  }

  const ALL_CONSTRAINT_NAMES = [
    "inventory_items_quantity_nonnegative_check",
    "technician_product_stock_quantity_nonnegative_check",
    "technicians_inventory_n950_boxes_nonnegative_check",
    "technicians_inventory_n950_units_nonnegative_check",
    "technicians_inventory_i9000s_boxes_nonnegative_check",
    "technicians_inventory_i9000s_units_nonnegative_check",
    "technicians_inventory_i9100_boxes_nonnegative_check",
    "technicians_inventory_i9100_units_nonnegative_check",
    "technicians_inventory_roll_paper_boxes_nonnegative_check",
    "technicians_inventory_roll_paper_units_nonnegative_check",
    "technicians_inventory_stickers_boxes_nonnegative_check",
    "technicians_inventory_stickers_units_nonnegative_check",
    "technicians_inventory_new_batteries_boxes_nonnegative_check",
    "technicians_inventory_new_batteries_units_nonnegative_check",
    "technicians_inventory_mobily_sim_boxes_nonnegative_check",
    "technicians_inventory_mobily_sim_units_nonnegative_check",
    "technicians_inventory_stc_sim_boxes_nonnegative_check",
    "technicians_inventory_stc_sim_units_nonnegative_check",
    "technicians_inventory_zain_sim_boxes_nonnegative_check",
    "technicians_inventory_zain_sim_units_nonnegative_check",
    "technicians_inventory_lebara_boxes_nonnegative_check",
    "technicians_inventory_lebara_units_nonnegative_check",
  ];

  it("all 22 target constraints exist and are fully validated", async () => {
    for (const name of ALL_CONSTRAINT_NAMES) {
      const rows = await db.execute(
        sql`select convalidated from pg_constraint where conname = ${name}`
      );
      const convalidated = (rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated;
      expect(convalidated, `constraint ${name} must exist and be validated`).toBe(true);
    }
  });

  it("rejects a negative inventory_items.quantity on INSERT", async () => {
    const id = randomUUID();
    await expect(
      db.insert(inventoryItems).values({
        id,
        name: `DBR1-${id.slice(0, 8)}`,
        type: "device",
        unit: "box",
        quantity: -1,
      })
    ).rejects.toThrow();
  });

  it("accepts zero and positive inventory_items.quantity", async () => {
    for (const quantity of [0, 1]) {
      const id = randomUUID();
      await expect(
        db.insert(inventoryItems).values({
          id,
          name: `DBR1-${quantity}-${id.slice(0, 8)}`,
          type: "device",
          unit: "box",
          quantity,
        })
      ).resolves.not.toThrow();
      createdInventoryItemIds.push(id);
    }
  });

  it("rejects a negative inventory_items.quantity on UPDATE, with no partial write", async () => {
    const id = randomUUID();
    await db.insert(inventoryItems).values({
      id,
      name: `DBR1-UPD-${id.slice(0, 8)}`,
      type: "device",
      unit: "box",
      quantity: 5,
    });
    createdInventoryItemIds.push(id);

    await expect(
      db.update(inventoryItems).set({ quantity: -1 }).where(eq(inventoryItems.id, id))
    ).rejects.toThrow();

    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    expect(row!.quantity).toBe(5);
  });

  it("rejects a negative technician_product_stock.quantity on INSERT", async () => {
    const { technicianId, productId } = await seedTechnicianAndProduct();
    const id = randomUUID();
    await expect(
      db.insert(technicianProductStock).values({
        id,
        technicianId,
        productId,
        quantity: -1,
      })
    ).rejects.toThrow();
  });

  it("accepts zero and positive technician_product_stock.quantity", async () => {
    for (const quantity of [0, 1]) {
      const { technicianId, productId } = await seedTechnicianAndProduct();
      const id = randomUUID();
      await expect(
        db.insert(technicianProductStock).values({
          id,
          technicianId,
          productId,
          quantity,
        })
      ).resolves.not.toThrow();
      createdStockIds.push(id);
    }
  });

  const TECHNICIANS_INVENTORY_FIELDS: Array<{ column: keyof typeof techniciansInventory.$inferInsert }> = [
    { column: "n950Boxes" },
    { column: "n950Units" },
    { column: "i9000sBoxes" },
    { column: "i9000sUnits" },
    { column: "i9100Boxes" },
    { column: "i9100Units" },
    { column: "rollPaperBoxes" },
    { column: "rollPaperUnits" },
    { column: "stickersBoxes" },
    { column: "stickersUnits" },
    { column: "newBatteriesBoxes" },
    { column: "newBatteriesUnits" },
    { column: "mobilySimBoxes" },
    { column: "mobilySimUnits" },
    { column: "stcSimBoxes" },
    { column: "stcSimUnits" },
    { column: "zainSimBoxes" },
    { column: "zainSimUnits" },
    { column: "lebaraBoxes" },
    { column: "lebaraUnits" },
  ];

  for (const { column } of TECHNICIANS_INVENTORY_FIELDS) {
    it(`rejects technicians_inventory.${String(column)} = -1 on INSERT`, async () => {
      const id = randomUUID();
      await expect(
        db.insert(techniciansInventory).values({
          id,
          technicianName: `DBR1-${String(column)}`,
          city: "Riyadh",
          [column]: -1,
        } as any)
      ).rejects.toThrow();
    });
  }

  it("accepts zero and positive values across all technicians_inventory boxes/units in a single row", async () => {
    const id = randomUUID();
    await expect(
      db.insert(techniciansInventory).values({
        id,
        technicianName: `DBR1-legal-${id.slice(0, 8)}`,
        city: "Riyadh",
        n950Boxes: 0,
        n950Units: 1,
        i9000sBoxes: 2,
        i9000sUnits: 0,
      })
    ).resolves.not.toThrow();
    createdTechInventoryIds.push(id);
  });

  it("rejects a negative technicians_inventory field on UPDATE, with no partial write", async () => {
    const id = randomUUID();
    await db.insert(techniciansInventory).values({
      id,
      technicianName: `DBR1-UPD-${id.slice(0, 8)}`,
      city: "Riyadh",
      n950Boxes: 3,
    });
    createdTechInventoryIds.push(id);

    await expect(
      db.update(techniciansInventory).set({ n950Boxes: -1 }).where(eq(techniciansInventory.id, id))
    ).rejects.toThrow();

    const [row] = await db.select().from(techniciansInventory).where(eq(techniciansInventory.id, id));
    expect(row!.n950Boxes).toBe(3);
  });
});

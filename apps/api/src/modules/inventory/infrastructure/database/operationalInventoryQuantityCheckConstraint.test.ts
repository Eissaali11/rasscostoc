/**
 * DB-R1 regression — Phase C4.6B.3 — operational inventory quantity
 * invariants.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R1 C4.6B.1/C4.6B.2 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R1, confirmed live in
 * Phase C4.6B.3): a mix of operational-quantity columns accepted illegal
 * integers with no rejection, because their sole protection was
 * application-layer logic. Two families, by confirmed semantics:
 *
 *   Family A (> 0, zero/negative illegal):
 *     warehouse_transfers.quantity
 *     courier_request_items.quantity
 *     item_types.unitsPerBox
 *
 *   Family B (>= 0, negative illegal, zero legal -- "not used"):
 *     courier_executions.paperRollQty / stickersQty / nulipCardsQty
 *     inventory_requests.* (10 product boxes/units pairs)
 *
 * Fix (migrations/0035 + 0036): CHECK constraints restricting these
 * columns to the semantics actually intended.
 *
 * Explicitly NOT covered here (different buckets, different governance
 * rounds): sales_invoice_lines.*, purchase_bill_lines.*,
 * sales_order_items.*, technician_sales_metrics_daily.* (deferred),
 * inventory_items.quantity / technician_product_stock.quantity /
 * technicians_inventory.* (C4.6B.1), transactions.quantity /
 * stock_movements.quantity (C4.6B.2), technician_fixed_inventories /
 * *_entries and warehouse_inventory / *_entries (Bucket B), and
 * technician_moving_inventory_entries (Bucket C).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import {
  warehouseTransfers,
  courierRequestItems,
  itemTypes,
  courierExecutions,
  inventoryRequests,
  users,
  warehouses,
  courierRequests,
} from "@shared/schema";

describe("DB-R1 — operational inventory quantity CHECK constraints (Phase C4.6B.3)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdWarehouseTransferIds: string[] = [];
  const createdCourierRequestItemIds: number[] = [];
  const createdItemTypeIds: string[] = [];
  const createdCourierExecutionRequestIds: number[] = [];
  const createdCourierRequestIds: number[] = [];
  const createdInventoryRequestIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdWarehouseIds: string[] = [];

  afterEach(async () => {
    for (const id of createdWarehouseTransferIds.splice(0)) {
      await db.delete(warehouseTransfers).where(eq(warehouseTransfers.id, id)).catch(() => {});
    }
    for (const id of createdCourierRequestItemIds.splice(0)) {
      await db.delete(courierRequestItems).where(eq(courierRequestItems.id, id)).catch(() => {});
    }
    for (const id of createdInventoryRequestIds.splice(0)) {
      await db.delete(inventoryRequests).where(eq(inventoryRequests.id, id)).catch(() => {});
    }
    for (const id of createdCourierExecutionRequestIds.splice(0)) {
      await db.delete(courierExecutions).where(eq(courierExecutions.requestId, id)).catch(() => {});
    }
    for (const id of createdCourierRequestIds.splice(0)) {
      await db.delete(courierRequests).where(eq(courierRequests.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdWarehouseIds.splice(0)) {
      await db.delete(warehouses).where(eq(warehouses.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedUser() {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      username: `dbr1b3-${userId.slice(0, 8)}`,
      email: `dbr1b3-${userId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 C4.6B.3 User",
      role: "admin",
    });
    createdUserIds.push(userId);
    return userId;
  }

  async function seedWarehouse(createdBy: string) {
    const warehouseId = randomUUID();
    await db.insert(warehouses).values({
      id: warehouseId,
      name: `DBR1B3-${warehouseId.slice(0, 8)}`,
      location: "Riyadh",
      createdBy,
    });
    createdWarehouseIds.push(warehouseId);
    return warehouseId;
  }

  async function seedCourierRequest() {
    const [row] = await db.insert(courierRequests).values({}).returning({ id: courierRequests.id });
    createdCourierRequestIds.push(row!.id);
    return row!.id;
  }

  const ALL_CONSTRAINT_NAMES = [
    "warehouse_transfers_quantity_positive_check",
    "courier_request_items_quantity_positive_check",
    "item_types_units_per_box_positive_check",
    "courier_executions_paper_roll_qty_nonnegative_check",
    "courier_executions_stickers_qty_nonnegative_check",
    "courier_executions_nulip_cards_qty_nonnegative_check",
    "inventory_requests_n950_boxes_nonnegative_check",
    "inventory_requests_n950_units_nonnegative_check",
    "inventory_requests_i9000s_boxes_nonnegative_check",
    "inventory_requests_i9000s_units_nonnegative_check",
    "inventory_requests_i9100_boxes_nonnegative_check",
    "inventory_requests_i9100_units_nonnegative_check",
    "inventory_requests_roll_paper_boxes_nonnegative_check",
    "inventory_requests_roll_paper_units_nonnegative_check",
    "inventory_requests_stickers_boxes_nonnegative_check",
    "inventory_requests_stickers_units_nonnegative_check",
    "inventory_requests_new_batteries_boxes_nonnegative_check",
    "inventory_requests_new_batteries_units_nonnegative_check",
    "inventory_requests_mobily_sim_boxes_nonnegative_check",
    "inventory_requests_mobily_sim_units_nonnegative_check",
    "inventory_requests_stc_sim_boxes_nonnegative_check",
    "inventory_requests_stc_sim_units_nonnegative_check",
    "inventory_requests_zain_sim_boxes_nonnegative_check",
    "inventory_requests_zain_sim_units_nonnegative_check",
    "inventory_requests_lebara_boxes_nonnegative_check",
    "inventory_requests_lebara_units_nonnegative_check",
  ];

  it("all 26 target constraints exist and are fully validated", async () => {
    for (const name of ALL_CONSTRAINT_NAMES) {
      const rows = await db.execute(
        sql`select convalidated from pg_constraint where conname = ${name}`
      );
      const convalidated = (rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated;
      expect(convalidated, `constraint ${name} must exist and be validated`).toBe(true);
    }
  });

  // ---- Family A: > 0 ----

  it("rejects warehouse_transfers.quantity = -1 and = 0, accepts positive", async () => {
    const userId = await seedUser();
    const warehouseId = await seedWarehouse(userId);

    for (const quantity of [-1, 0]) {
      const id = randomUUID();
      await expect(
        db.insert(warehouseTransfers).values({
          id,
          warehouseId,
          technicianId: userId,
          itemType: "n950",
          packagingType: "boxes",
          quantity,
          performedBy: userId,
        })
      ).rejects.toThrow();
    }

    const id = randomUUID();
    await expect(
      db.insert(warehouseTransfers).values({
        id,
        warehouseId,
        technicianId: userId,
        itemType: "n950",
        packagingType: "boxes",
        quantity: 1,
        performedBy: userId,
      })
    ).resolves.not.toThrow();
    createdWarehouseTransferIds.push(id);
  });

  it("rejects courier_request_items.quantity = -1 and = 0, accepts positive", async () => {
    const requestId = await seedCourierRequest();

    for (const quantity of [-1, 0]) {
      await expect(
        db.insert(courierRequestItems).values({
          requestId,
          itemType: "POS",
          quantity,
        })
      ).rejects.toThrow();
    }

    const [row] = await db
      .insert(courierRequestItems)
      .values({ requestId, itemType: "POS", quantity: 1 })
      .returning({ id: courierRequestItems.id });
    createdCourierRequestItemIds.push(row!.id);
  });

  it("rejects item_types.unitsPerBox = -1 and = 0, accepts positive", async () => {
    for (const unitsPerBox of [-1, 0]) {
      const id = randomUUID();
      await expect(
        db.insert(itemTypes).values({
          id,
          nameAr: `منتج-${id.slice(0, 8)}`,
          nameEn: `Product-${id.slice(0, 8)}`,
          category: "devices",
          unitsPerBox,
        })
      ).rejects.toThrow();
    }

    const id = randomUUID();
    await expect(
      db.insert(itemTypes).values({
        id,
        nameAr: `منتج-${id.slice(0, 8)}`,
        nameEn: `Product-${id.slice(0, 8)}`,
        category: "devices",
        unitsPerBox: 5,
      })
    ).resolves.not.toThrow();
    createdItemTypeIds.push(id);
  });

  // ---- Family B: >= 0 ----

  it("rejects negative courier_executions.paperRollQty/stickersQty/nulipCardsQty, accepts zero and positive", async () => {
    const requestId = await seedCourierRequest();

    await expect(
      db.insert(courierExecutions).values({ requestId, paperRollQty: -1 })
    ).rejects.toThrow();

    const requestId2 = await seedCourierRequest();
    await expect(
      db.insert(courierExecutions).values({ requestId: requestId2, stickersQty: -1 })
    ).rejects.toThrow();

    const requestId3 = await seedCourierRequest();
    await expect(
      db.insert(courierExecutions).values({ requestId: requestId3, nulipCardsQty: -1 })
    ).rejects.toThrow();

    const requestId4 = await seedCourierRequest();
    await expect(
      db.insert(courierExecutions).values({
        requestId: requestId4,
        paperRollQty: 0,
        stickersQty: 0,
        nulipCardsQty: 0,
      })
    ).resolves.not.toThrow();
    createdCourierExecutionRequestIds.push(requestId4);
  });

  const INVENTORY_REQUESTS_FIELDS: Array<{ column: keyof typeof inventoryRequests.$inferInsert }> = [
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

  for (const { column } of INVENTORY_REQUESTS_FIELDS) {
    it(`rejects inventory_requests.${String(column)} = -1 on INSERT`, async () => {
      const userId = await seedUser();
      const id = randomUUID();
      await expect(
        db.insert(inventoryRequests).values({
          id,
          technicianId: userId,
          [column]: -1,
        } as any)
      ).rejects.toThrow();
    });
  }

  it("accepts zero and positive values across all inventory_requests boxes/units in a single row", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await expect(
      db.insert(inventoryRequests).values({
        id,
        technicianId: userId,
        n950Boxes: 0,
        n950Units: 1,
        i9000sBoxes: 2,
        i9000sUnits: 0,
      })
    ).resolves.not.toThrow();
    createdInventoryRequestIds.push(id);
  });

  it("rejects a negative inventory_requests field on UPDATE, with no partial write", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await db.insert(inventoryRequests).values({
      id,
      technicianId: userId,
      n950Boxes: 3,
    });
    createdInventoryRequestIds.push(id);

    await expect(
      db.update(inventoryRequests).set({ n950Boxes: -1 }).where(eq(inventoryRequests.id, id))
    ).rejects.toThrow();

    const [row] = await db.select().from(inventoryRequests).where(eq(inventoryRequests.id, id));
    expect(row!.n950Boxes).toBe(3);
  });
});

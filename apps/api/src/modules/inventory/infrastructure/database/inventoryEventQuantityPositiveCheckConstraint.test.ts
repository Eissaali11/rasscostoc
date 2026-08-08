/**
 * DB-R1 regression — Phase C4.6B.2 — positive CHECK constraints for
 * INVENTORY EVENT quantity fields.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R1/DB-R2/DB-R7/DB-R8/DB-R9 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R1, confirmed live in
 * Phase C4.6B.2): transactions.quantity and stock_movements.quantity both
 * represent an unsigned event magnitude -- direction is carried separately
 * (transactions.type; stock_movements.fromInventory/toInventory) -- yet
 * neither column rejected zero or negative integers; their sole protection
 * was application-layer logic.
 *
 * Fix (migrations/0033 + 0034): CHECK (... > 0) constraints restricting
 * these columns to the semantics actually intended -- only positive values
 * legal, zero and negative illegal.
 *
 * Explicitly NOT covered here (different buckets, different governance
 * rounds): inventory_items.quantity / technician_product_stock.quantity /
 * technicians_inventory.* (Phase C4.6B.1, already merged),
 * technician_fixed_inventories / *_entries and warehouse_inventory /
 * *_entries (Bucket B, architecturally blocked),
 * technician_moving_inventory_entries (Bucket C, open concurrency finding).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { transactions, stockMovements, inventoryItems, users } from "@shared/schema";

describe("DB-R1 — inventory event quantity positive CHECK constraints (Phase C4.6B.2)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdTransactionIds: string[] = [];
  const createdStockMovementIds: string[] = [];
  const createdInventoryItemIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdTransactionIds.splice(0)) {
      await db.delete(transactions).where(eq(transactions.id, id)).catch(() => {});
    }
    for (const id of createdStockMovementIds.splice(0)) {
      await db.delete(stockMovements).where(eq(stockMovements.id, id)).catch(() => {});
    }
    for (const id of createdInventoryItemIds.splice(0)) {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedUser() {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      username: `dbr1b2-${userId.slice(0, 8)}`,
      email: `dbr1b2-${userId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 C4.6B.2 User",
      role: "technician",
    });
    createdUserIds.push(userId);
    return userId;
  }

  async function seedInventoryItem() {
    const itemId = randomUUID();
    await db.insert(inventoryItems).values({
      id: itemId,
      name: `DBR1B2-${itemId.slice(0, 8)}`,
      type: "device",
      unit: "box",
      quantity: 100,
    });
    createdInventoryItemIds.push(itemId);
    return itemId;
  }

  const ALL_CONSTRAINT_NAMES = [
    "transactions_quantity_positive_check",
    "stock_movements_quantity_positive_check",
  ];

  it("both target constraints exist and are fully validated", async () => {
    for (const name of ALL_CONSTRAINT_NAMES) {
      const rows = await db.execute(
        sql`select convalidated from pg_constraint where conname = ${name}`
      );
      const convalidated = (rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated;
      expect(convalidated, `constraint ${name} must exist and be validated`).toBe(true);
    }
  });

  it("rejects transactions.quantity = -1 on INSERT", async () => {
    const userId = await seedUser();
    const itemId = await seedInventoryItem();
    const id = randomUUID();
    await expect(
      db.insert(transactions).values({
        id,
        itemId,
        userId,
        type: "inbound",
        quantity: -1,
      })
    ).rejects.toThrow();
  });

  it("rejects transactions.quantity = 0 on INSERT", async () => {
    const userId = await seedUser();
    const itemId = await seedInventoryItem();
    const id = randomUUID();
    await expect(
      db.insert(transactions).values({
        id,
        itemId,
        userId,
        type: "inbound",
        quantity: 0,
      })
    ).rejects.toThrow();
  });

  it("accepts a positive transactions.quantity", async () => {
    const userId = await seedUser();
    const itemId = await seedInventoryItem();
    const id = randomUUID();
    await expect(
      db.insert(transactions).values({
        id,
        itemId,
        userId,
        type: "inbound",
        quantity: 1,
      })
    ).resolves.not.toThrow();
    createdTransactionIds.push(id);
  });

  it("rejects a negative transactions.quantity on UPDATE, with no partial write", async () => {
    const userId = await seedUser();
    const itemId = await seedInventoryItem();
    const id = randomUUID();
    await db.insert(transactions).values({
      id,
      itemId,
      userId,
      type: "inbound",
      quantity: 5,
    });
    createdTransactionIds.push(id);

    await expect(
      db.update(transactions).set({ quantity: -1 }).where(eq(transactions.id, id))
    ).rejects.toThrow();

    const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
    expect(row!.quantity).toBe(5);
  });

  it("rejects stock_movements.quantity = -1 on INSERT", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await expect(
      db.insert(stockMovements).values({
        id,
        technicianId: userId,
        itemType: "n950",
        packagingType: "boxes",
        quantity: -1,
        fromInventory: "warehouse",
        toInventory: "technician",
        performedBy: userId,
      })
    ).rejects.toThrow();
  });

  it("rejects stock_movements.quantity = 0 on INSERT", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await expect(
      db.insert(stockMovements).values({
        id,
        technicianId: userId,
        itemType: "n950",
        packagingType: "boxes",
        quantity: 0,
        fromInventory: "warehouse",
        toInventory: "technician",
        performedBy: userId,
      })
    ).rejects.toThrow();
  });

  it("accepts a positive stock_movements.quantity", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await expect(
      db.insert(stockMovements).values({
        id,
        technicianId: userId,
        itemType: "n950",
        packagingType: "boxes",
        quantity: 1,
        fromInventory: "warehouse",
        toInventory: "technician",
        performedBy: userId,
      })
    ).resolves.not.toThrow();
    createdStockMovementIds.push(id);
  });

  it("rejects a negative stock_movements.quantity on UPDATE, with no partial write", async () => {
    const userId = await seedUser();
    const id = randomUUID();
    await db.insert(stockMovements).values({
      id,
      technicianId: userId,
      itemType: "n950",
      packagingType: "boxes",
      quantity: 3,
      fromInventory: "warehouse",
      toInventory: "technician",
      performedBy: userId,
    });
    createdStockMovementIds.push(id);

    await expect(
      db.update(stockMovements).set({ quantity: -1 }).where(eq(stockMovements.id, id))
    ).rejects.toThrow();

    const [row] = await db.select().from(stockMovements).where(eq(stockMovements.id, id));
    expect(row!.quantity).toBe(3);
  });
});

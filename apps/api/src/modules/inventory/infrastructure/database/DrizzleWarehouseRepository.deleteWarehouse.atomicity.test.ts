/**
 * DB-R8 regression — DrizzleWarehouseRepository.deleteWarehouse() atomicity.
 *
 * Runs only via `npm run test:database` against a real, disposable Postgres
 * test database (never a shared/production one — guarded below, same
 * pattern as core/testing/foundation/database-foundation.smoke.test.ts).
 *
 * Root cause (Phase C — Database Certification, DB-R8): deleteWarehouse()
 * issued four separate DELETE statements with no db.transaction() wrapper.
 * When the final `delete(warehouses)` was rejected by a real FK (an `items`
 * row still referencing the warehouse via `warehouseId` with
 * onDelete: "restrict"), the three prior deletes had already committed —
 * a partial write: the warehouse's inventory_requests history was gone,
 * but the warehouse row itself survived the rejected final delete.
 *
 * This test proves the fixed behavior: on failure, ALL writes roll back
 * (the warehouse and its dependent rows are unchanged); on success, ALL
 * writes commit together.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { repositories } from "./index";
import {
  users,
  itemTypes,
  warehouses,
  inventoryRequests,
  items,
} from "@shared/schema";

describe("DB-R8 — DrizzleWarehouseRepository.deleteWarehouse() atomicity", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdWarehouseIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdItemTypeIds: string[] = [];

  afterEach(async () => {
    // Best-effort cleanup only — the whole point of this test is that a
    // rejected delete must leave rows in place, so we cannot assume they
    // are gone.
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(items).where(eq(items.itemTypeId, id)).catch(() => {});
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdWarehouseIds.splice(0)) {
      await db.delete(inventoryRequests).where(eq(inventoryRequests.warehouseId, id)).catch(() => {});
      await db.delete(warehouses).where(eq(warehouses.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedUser() {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `db-r8-test-${id.slice(0, 8)}`,
      email: `db-r8-test-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R8 Test User",
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedWarehouse(createdBy: string) {
    const id = randomUUID();
    await db.insert(warehouses).values({
      id,
      name: `DB-R8 Test Warehouse ${id.slice(0, 8)}`,
      location: "Riyadh",
      createdBy,
    });
    createdWarehouseIds.push(id);
    return id;
  }

  it("failure path: an item still referencing the warehouse (FK restrict) blocks deletion WITHOUT losing the warehouse's other history", async () => {
    const userId = await seedUser();
    const warehouseId = await seedWarehouse(userId);

    // A dependent record that deleteWarehouse() is also responsible for
    // cleaning up when the delete actually succeeds.
    await db.insert(inventoryRequests).values({
      id: randomUUID(),
      warehouseId,
      technicianId: userId,
      status: "pending",
    });

    // A record that legitimately blocks warehouse deletion via a real FK
    // (items.warehouse_id -> warehouses.id, onDelete: "restrict").
    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: "نوع",
      nameEn: "Type",
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId);
    await db.insert(items).values({
      id: randomUUID(),
      itemTypeId,
      serialNumber: `DBR8-BLOCK-${warehouseId.slice(0, 8)}`,
      barcode: `DBR8-BAR-${warehouseId.slice(0, 8)}`,
      status: "WAREHOUSE",
      warehouseId,
    });

    await expect(repositories.warehouse.deleteWarehouse(warehouseId)).rejects.toThrow();

    // The whole point of this test: nothing was left partially deleted.
    const [warehouseRow] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId));
    expect(warehouseRow).toBeDefined();

    const requestRows = await db
      .select()
      .from(inventoryRequests)
      .where(eq(inventoryRequests.warehouseId, warehouseId));
    expect(requestRows).toHaveLength(1);
  });

  it("success path: with no blocking item, the warehouse and all its dependent rows are deleted together", async () => {
    const userId = await seedUser();
    const warehouseId = await seedWarehouse(userId);

    await db.insert(inventoryRequests).values({
      id: randomUUID(),
      warehouseId,
      technicianId: userId,
      status: "pending",
    });

    const deleted = await repositories.warehouse.deleteWarehouse(warehouseId);
    expect(deleted).toBe(true);

    const [warehouseRow] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId));
    expect(warehouseRow).toBeUndefined();

    const requestRows = await db
      .select()
      .from(inventoryRequests)
      .where(eq(inventoryRequests.warehouseId, warehouseId));
    expect(requestRows).toHaveLength(0);

    // Deleted successfully — do not attempt cleanup on this id again.
    createdWarehouseIds.splice(createdWarehouseIds.indexOf(warehouseId), 1);
  });
});

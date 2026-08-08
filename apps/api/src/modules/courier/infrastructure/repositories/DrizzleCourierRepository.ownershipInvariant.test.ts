/**
 * DB-R7 regression — ownership write-path safety for
 * DrizzleCourierRepository.transferCustodyToTechnician() and
 * DrizzleCourierRepository.linkSimToTechnician().
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R8/DB-R9 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R7, confirmed in
 * Phase C4.4A pre-remediation): the database allows an `items` row to have
 * both `current_owner_id` and `warehouse_id` set simultaneously (proven
 * live against a real Postgres instance in C4.4A). Two active write paths
 * assign `current_owner_id` without clearing `warehouse_id`:
 * transferCustodyToTechnician() and linkSimToTechnician()'s
 * owner-assignment branch. If either is ever called on an item that
 * currently has a non-null warehouseId, the item ends up with both fields
 * set — a "dual ownership" state with no single source of truth for where
 * the physical device actually is.
 *
 * This phase (C4.4B) fixes only the two confirmed application write
 * paths — it does not add a database-level CHECK constraint (that is
 * C4.4C, gated on a production BOTH_SET precheck).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { DrizzleCourierRepository } from "./drizzle-courier.repository";
import {
  users,
  itemTypes,
  items,
  warehouses,
  inventoryTransactions,
  itemHistoryLogs,
} from "@shared/schema";

describe("DB-R7 — DrizzleCourierRepository ownership write-path invariant", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdItemIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdItemTypeIds: string[] = [];
  const createdWarehouseIds: string[] = [];

  afterEach(async () => {
    for (const id of createdItemIds.splice(0)) {
      await db.delete(inventoryTransactions).where(eq(inventoryTransactions.itemId, id)).catch(() => {});
      await db.delete(itemHistoryLogs).where(eq(itemHistoryLogs.itemId, id)).catch(() => {});
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
    }
    for (const id of createdWarehouseIds.splice(0)) {
      await db.delete(warehouses).where(eq(warehouses.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedTechnician(label: string) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `db-r7-${label}-${id.slice(0, 8)}`,
      email: `db-r7-${label}-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: `DB-R7 ${label}`,
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedWarehouse(createdBy: string) {
    const id = randomUUID();
    await db.insert(warehouses).values({
      id,
      name: `DB-R7 Warehouse ${id.slice(0, 8)}`,
      location: "Riyadh",
      createdBy,
    });
    createdWarehouseIds.push(id);
    return id;
  }

  async function seedItemInWarehouse(warehouseId: string) {
    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: "نوع",
      nameEn: "Type",
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId);

    const itemId = randomUUID();
    await db.insert(items).values({
      id: itemId,
      itemTypeId,
      serialNumber: `DBR7-${itemId.slice(0, 8)}`,
      barcode: `DBR7-BAR-${itemId.slice(0, 8)}`,
      status: "WAREHOUSE",
      warehouseId,
    });
    createdItemIds.push(itemId);
    return itemId;
  }

  it("transferCustodyToTechnician: an item held by a warehouse ends up with warehouse_id cleared, not dual-owned", async () => {
    const admin = await seedTechnician("admin");
    const technician = await seedTechnician("recipient");
    const warehouseId = await seedWarehouse(admin);
    const itemId = await seedItemInWarehouse(warehouseId);

    const repo = new DrizzleCourierRepository();
    await repo.transferCustodyToTechnician({
      itemId,
      technicianId: technician,
      requestId: 4001,
      oldStatus: "WAREHOUSE",
      newStatus: "RECEIVED_BY_TECHNICIAN",
    });

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemRow!.currentOwnerId).toBe(technician);
    // The whole point of DB-R7: no dual ownership after a custody transfer.
    expect(itemRow!.warehouseId).toBeNull();
  });

  it("linkSimToTechnician: assigning an owner to a warehouse-held item clears warehouse_id, not dual-owned", async () => {
    const admin = await seedTechnician("admin2");
    const technician = await seedTechnician("simRecipient");
    const warehouseId = await seedWarehouse(admin);
    const itemId = await seedItemInWarehouse(warehouseId);
    // linkSimToTechnician looks the item up by serialNumber/barcode.
    const [existing] = await db.select().from(items).where(eq(items.id, itemId));

    const repo = new DrizzleCourierRepository();
    await repo.linkSimToTechnician({
      simSerial: existing!.serialNumber!,
      simType: "STC",
      technicianId: technician,
    });

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemRow!.currentOwnerId).toBe(technician);
    expect(itemRow!.warehouseId).toBeNull();
  });

  it("DB-R9 regression protection: concurrent transferCustodyToTechnician attempts still allow exactly one winner, with warehouse_id cleared for the winner", async () => {
    const admin = await seedTechnician("admin3");
    const technicianA = await seedTechnician("raceA");
    const technicianB = await seedTechnician("raceB");
    const warehouseId = await seedWarehouse(admin);
    const itemId = await seedItemInWarehouse(warehouseId);

    const repoA = new DrizzleCourierRepository();
    const repoB = new DrizzleCourierRepository();

    const results = await Promise.allSettled([
      repoA.transferCustodyToTechnician({
        itemId,
        technicianId: technicianA,
        requestId: 5001,
        oldStatus: "WAREHOUSE",
        newStatus: "RECEIVED_BY_TECHNICIAN",
      }),
      repoB.transferCustodyToTechnician({
        itemId,
        technicianId: technicianB,
        requestId: 5002,
        oldStatus: "WAREHOUSE",
        newStatus: "RECEIVED_BY_TECHNICIAN",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect([technicianA, technicianB]).toContain(itemRow!.currentOwnerId);
    expect(itemRow!.warehouseId).toBeNull();

    const txRows = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId));
    expect(txRows).toHaveLength(1);
  });

  it("legal states remain supported: OWNER_ONLY, WAREHOUSE_ONLY, and BOTH_NULL are all still accepted by the schema", async () => {
    const admin = await seedTechnician("admin4");
    const technician = await seedTechnician("ownerOnly");
    const warehouseId = await seedWarehouse(admin);

    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: "نوع",
      nameEn: "Type",
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId);

    // OWNER_ONLY
    const ownerOnlyId = randomUUID();
    await db.insert(items).values({
      id: ownerOnlyId,
      itemTypeId,
      serialNumber: `DBR7-OWNERONLY-${ownerOnlyId.slice(0, 8)}`,
      barcode: `DBR7-BAR-A-${ownerOnlyId.slice(0, 8)}`,
      status: "RECEIVED_BY_TECHNICIAN",
      currentOwnerId: technician,
    });
    createdItemIds.push(ownerOnlyId);

    // WAREHOUSE_ONLY
    const warehouseOnlyId = randomUUID();
    await db.insert(items).values({
      id: warehouseOnlyId,
      itemTypeId,
      serialNumber: `DBR7-WHONLY-${warehouseOnlyId.slice(0, 8)}`,
      barcode: `DBR7-BAR-B-${warehouseOnlyId.slice(0, 8)}`,
      status: "WAREHOUSE",
      warehouseId,
    });
    createdItemIds.push(warehouseOnlyId);

    // BOTH_NULL (legal for DELIVERED, per scanOut's real behavior)
    const bothNullId = randomUUID();
    await db.insert(items).values({
      id: bothNullId,
      itemTypeId,
      serialNumber: `DBR7-BOTHNULL-${bothNullId.slice(0, 8)}`,
      barcode: `DBR7-BAR-C-${bothNullId.slice(0, 8)}`,
      status: "DELIVERED",
    });
    createdItemIds.push(bothNullId);

    const rows = await db
      .select()
      .from(items)
      .where(eq(items.itemTypeId, itemTypeId));
    expect(rows).toHaveLength(3);
  });
});

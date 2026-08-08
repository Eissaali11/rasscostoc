/**
 * DB-R1 regression — Phase C4.6C.3 — moving inventory nonnegative
 * database invariants.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the other DB-R1 regression tests).
 *
 * Root cause (Phase C — Database Certification, Bucket C, identified as
 * a side finding during Phase C4.6C.1/C4.6C.2): technician_moving_
 * inventory_entries.boxes/units -- the technician current-balance table
 * whose concurrency race was fixed in C4.6C.2 -- accepted negative
 * integers with no DB-level rejection. Application-layer protection
 * existed (WithdrawTechnicianInventoryToWarehouseUseCase now rejects a
 * withdrawal before it would go negative, since C4.6C.2; custody-engine.ts
 * clamps with Math.max(0, ...)), but no CHECK constraint enforced it at
 * the database layer, matching the exact pattern already remediated for
 * the sibling table technicians_inventory in Phase C4.6B.1.
 *
 * Fix (migrations/0041 + 0042): CHECK (... >= 0) constraints for exactly
 * these two columns.
 *
 * Explicitly OUT of scope: warehouse_inventory / warehouse_inventory_entries,
 * technician_fixed_inventories / technician_fixed_inventory_entries
 * (Bucket B, untouched); all prior DB-R1 slices (C4.6B.1-5, C4.6C.2,
 * already fixed and merged); the C4.6C.2 shared-transaction/locking
 * concurrency fix itself (unmodified by this migration).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { sql } from "drizzle-orm";
import { technicianMovingInventoryEntries, users, itemTypes } from "@shared/schema";

describe("DB-R1 — moving inventory nonnegative CHECK constraints (Phase C4.6C.3)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdEntryIds: string[] = [];
  const createdUserIds: string[] = [];
  const itemTypeId = "n950";

  afterEach(async () => {
    for (const id of createdEntryIds.splice(0)) {
      await db.delete(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedTechnician() {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `dbr1c3-${id.slice(0, 8)}`,
      email: `dbr1c3-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 C4.6C.3 Technician",
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function ensureItemType() {
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: "N950",
      nameEn: "N950",
      category: "devices",
      unitsPerBox: 10,
    }).onConflictDoNothing();
  }

  const ALL_CONSTRAINT_NAMES = [
    "technician_moving_inventory_entries_boxes_nonnegative_check",
    "technician_moving_inventory_entries_units_nonnegative_check",
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

  it("rejects boxes = -1 on INSERT, accepts zero and positive", async () => {
    const technicianId = await seedTechnician();
    await ensureItemType();

    await expect(
      db.insert(technicianMovingInventoryEntries).values({
        technicianId,
        itemTypeId,
        boxes: -1,
        units: 0,
      })
    ).rejects.toThrow();

    for (const boxes of [0, 1]) {
      const [row] = await db
        .insert(technicianMovingInventoryEntries)
        .values({ technicianId, itemTypeId, boxes, units: 0 })
        .returning({ id: technicianMovingInventoryEntries.id });
      createdEntryIds.push(row!.id);
    }
  });

  it("rejects units = -1 on INSERT, accepts zero and positive", async () => {
    const technicianId = await seedTechnician();
    await ensureItemType();

    await expect(
      db.insert(technicianMovingInventoryEntries).values({
        technicianId,
        itemTypeId,
        boxes: 0,
        units: -1,
      })
    ).rejects.toThrow();

    for (const units of [0, 1]) {
      const [row] = await db
        .insert(technicianMovingInventoryEntries)
        .values({ technicianId, itemTypeId, boxes: 0, units })
        .returning({ id: technicianMovingInventoryEntries.id });
      createdEntryIds.push(row!.id);
    }
  });

  it("rejects a negative boxes value on UPDATE, with no partial write", async () => {
    const technicianId = await seedTechnician();
    await ensureItemType();

    const [row] = await db
      .insert(technicianMovingInventoryEntries)
      .values({ technicianId, itemTypeId, boxes: 3, units: 2 })
      .returning({ id: technicianMovingInventoryEntries.id });
    createdEntryIds.push(row!.id);

    await expect(
      db.update(technicianMovingInventoryEntries).set({ boxes: -1 }).where(eq(technicianMovingInventoryEntries.id, row!.id))
    ).rejects.toThrow();

    const [after] = await db.select().from(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.id, row!.id));
    expect(after!.boxes).toBe(3);
    expect(after!.units).toBe(2);
  });
});

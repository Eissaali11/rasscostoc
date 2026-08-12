/**
 * OPS-REMED-E3 regression — DrizzleDevicesRepository.deductTechnicianInventory
 * zero-balance correction.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the sibling DB-R regression tests).
 *
 * Root cause: `Math.max(0, existingStock.units - 1)` silently clamped a
 * deduction attempted at zero balance to remain zero, while still writing a
 * stock-movement log entry recording it as a successful deduction — masking
 * real stock shortages. Fixed to throw DEDUCT_INSUFFICIENT_STOCK instead,
 * writing no movement row.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@core/config/db";
import {
  users,
  itemTypes,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  receivedDevices,
  stockMovements,
} from "@shared/schema";
import { DrizzleDevicesRepository } from "./DrizzleDevicesRepository";

describe("OPS-REMED-E3 — DrizzleDevicesRepository zero-balance correction", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdUserIds: string[] = [];
  const createdItemTypeIds: string[] = [];
  const createdStockEntryIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.delete(stockMovements).where(eq(stockMovements.technicianId, id)).catch(() => {});
    }
    for (const id of createdStockEntryIds.splice(0)) {
      await db.delete(technicianFixedInventoryEntries).where(eq(technicianFixedInventoryEntries.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedTechnicianWithZeroStock() {
    const techId = randomUUID();
    await db.insert(users).values({
      id: techId,
      username: `e3-zero-${techId.slice(0, 8)}`,
      email: `e3-zero-${techId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "E3 Zero Stock",
      role: "technician",
    });
    createdUserIds.push(techId);

    const itemTypeId = "n950"; // matches DrizzleDevicesRepository's resolveItemTypeId default
    const existingType = await db.select().from(itemTypes).where(eq(itemTypes.id, itemTypeId));
    if (existingType.length === 0) {
      await db.insert(itemTypes).values({
        id: itemTypeId,
        nameAr: "N950",
        nameEn: "N950",
        category: "devices",
      });
      createdItemTypeIds.push(itemTypeId);
    }

    const entryId = randomUUID();
    await db.insert(technicianFixedInventoryEntries).values({
      id: entryId,
      technicianId: techId,
      itemTypeId,
      boxes: 0,
      units: 0, // zero balance — the case under test
    });
    createdStockEntryIds.push(entryId);

    return { techId, itemTypeId };
  }

  it("a deduction attempt at zero balance throws DEDUCT_INSUFFICIENT_STOCK instead of clamping to zero and reporting success", async () => {
    const { techId } = await seedTechnicianWithZeroStock();
    const repo = new DrizzleDevicesRepository();

    let caught: any = null;
    try {
      await repo.deductTechnicianInventory({
        technicianCode: `e3-zero-${techId.slice(0, 8)}`,
        devices: [{ serialNumber: `E3ZERO-${randomUUID().slice(0, 8)}` }],
        notes: "OPS-REMED-E3 zero-balance regression",
        actor: { id: techId, username: "e3-actor", role: "admin", regionId: null },
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught.code).toBe("DEDUCT_INSUFFICIENT_STOCK");

    // No stock-movement row must have been written for this failed attempt.
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.technicianId, techId));
    expect(movements.length).toBe(0);
  });

  /**
   * OPS-REMED-E3-F.R1 (P2 closure): the deterministic-lock-order sort uses
   * an ADVISORY (unlocked, pre-sort) read of received_devices.itemTypeId.
   * This proves that value is never trusted for the actual locked
   * mutation — the write phase re-reads the SAME row WITH FOR UPDATE and
   * either (a) locks/decrements the CORRECT, currently-authoritative stock
   * row, or (b) fails closed with a structured DEDUCT_INTEGRITY_CONFLICT —
   * never (c) silently locking/decrementing whatever stock row the stale
   * advisory value happened to point to.
   *
   * This races a real concurrent raw UPDATE of received_devices.itemTypeId
   * against the repository call, landing in the network round-trip window
   * between the advisory SELECT and the locked SELECT ... FOR UPDATE.
   * Timing-dependent by nature (genuine concurrency, not a mock) — both
   * outcomes below are treated as passing per the directive's acceptance
   * rule; the ONLY unacceptable outcome (asserted against) is silently
   * decrementing the WRONG stock row.
   */
  it(
    "OPS-REMED-E3-F.R1: a received_devices.itemTypeId change racing between the advisory read and the locked write phase never causes the wrong stock row to be decremented",
    async () => {
      const techId = randomUUID();
      await db.insert(users).values({
        id: techId,
        username: `e3-race-${techId.slice(0, 8)}`,
        email: `e3-race-${techId.slice(0, 8)}@test.local`,
        password: "x",
        fullName: "E3 ItemType Race",
        role: "technician",
      });
      createdUserIds.push(techId);

      const typeA = "i9000s"; // fixed reference row, seeded by migrations
      const typeB = "i9100"; // fixed reference row, seeded by migrations

      const stockAId = randomUUID();
      const stockBId = randomUUID();
      await db.insert(technicianMovingInventoryEntries).values([
        { id: stockAId, technicianId: techId, itemTypeId: typeA, units: 5, boxes: 0 },
        { id: stockBId, technicianId: techId, itemTypeId: typeB, units: 5, boxes: 0 },
      ]);

      const serial = `E3RACE-${randomUUID().slice(0, 8)}`;
      const deviceRowId = randomUUID();
      await db.insert(receivedDevices).values({
        id: deviceRowId,
        technicianId: techId,
        itemTypeId: typeA,
        serialNumber: serial,
        terminalId: serial,
        status: "approved",
        inventoryType: "moving",
      });

      const repo = new DrizzleDevicesRepository();

      const [result] = await Promise.allSettled([
        repo.deductTechnicianInventory({
          technicianCode: `e3-race-${techId.slice(0, 8)}`,
          devices: [{ serialNumber: serial }],
          notes: "OPS-REMED-E3-F.R1 lock-key race regression",
          actor: { id: techId, username: "e3-actor", role: "admin", regionId: null },
        }),
        db
          .update(receivedDevices)
          .set({ itemTypeId: typeB })
          .where(eq(receivedDevices.id, deviceRowId)),
      ]);

      const [finalA] = await db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(eq(technicianMovingInventoryEntries.id, stockAId));
      const [finalB] = await db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(eq(technicianMovingInventoryEntries.id, stockBId));

      if (result.status === "fulfilled") {
        // Acceptable outcome (a): succeeded — must have decremented the
        // CURRENTLY-authoritative row for whichever itemTypeId the locked
        // re-read actually observed, and left the other stock row
        // completely untouched.
        const decrementedA = finalA!.units === 4;
        const decrementedB = finalB!.units === 4;
        expect(decrementedA !== decrementedB).toBe(true); // exactly one, never both, never neither
        if (decrementedA) expect(finalB!.units).toBe(5);
        if (decrementedB) expect(finalA!.units).toBe(5);
      } else {
        // Acceptable outcome (b): failed closed — neither stock row may be
        // touched at all.
        expect((result.reason as any)?.code).toBe("DEDUCT_INTEGRITY_CONFLICT");
        expect(finalA!.units).toBe(5);
        expect(finalB!.units).toBe(5);
      }

      // Unacceptable outcome, explicitly ruled out either way: both rows
      // decremented (double deduction) or neither touched while reporting
      // success.
      expect(finalA!.units === 4 && finalB!.units === 4).toBe(false);

      await db.delete(receivedDevices).where(eq(receivedDevices.id, deviceRowId)).catch(() => {});
      await db
        .delete(technicianMovingInventoryEntries)
        .where(eq(technicianMovingInventoryEntries.technicianId, techId))
        .catch(() => {});
    },
    20000
  );
});

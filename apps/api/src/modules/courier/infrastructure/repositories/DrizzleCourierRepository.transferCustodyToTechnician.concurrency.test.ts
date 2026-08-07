/**
 * DB-R9 regression — DrizzleCourierRepository.transferCustodyToTechnician()
 * concurrency safety.
 *
 * Runs only via `npm run test:database`-style real disposable Postgres
 * (guarded below, same pattern as
 * core/testing/foundation/database-foundation.smoke.test.ts and the DB-R8
 * regression test). Uses two genuinely concurrent calls against the same
 * real database connection pool — not a simulated/sequential race — so a
 * true row-level race condition is exercised.
 *
 * Root cause (Phase C — Database Certification, DB-R9): the active
 * production path (courier.service.ts -> ctx.inventoryPort ->
 * DrizzleCourierRepository.transferCustodyToTechnician(), wired via
 * DrizzleCourierUnitOfWork) updated `items.current_owner_id`/`status` with
 * no WHERE condition on the item's expected previous status, even though
 * the caller always fetches and passes that expected `oldStatus`. Two
 * technicians racing to receive the same item could both have their
 * UPDATE succeed and both get an `inventory_transactions` "success" row,
 * even though only one technician can legitimately end up holding the
 * item — a lost update with a contradictory audit trail.
 *
 * This test proves the fixed behavior: of two genuinely concurrent
 * transfer attempts for the same item and the same expected oldStatus,
 * exactly one succeeds; the other is rejected with a conflict error and
 * writes no inventory_transactions/item_history_logs row.
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
  inventoryTransactions,
  itemHistoryLogs,
} from "@shared/schema";

describe("DB-R9 — DrizzleCourierRepository.transferCustodyToTechnician() concurrency", () => {
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

  afterEach(async () => {
    for (const id of createdItemIds.splice(0)) {
      await db.delete(inventoryTransactions).where(eq(inventoryTransactions.itemId, id)).catch(() => {});
      await db.delete(itemHistoryLogs).where(eq(itemHistoryLogs.itemId, id)).catch(() => {});
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
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
      username: `db-r9-${label}-${id.slice(0, 8)}`,
      email: `db-r9-${label}-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: `DB-R9 Technician ${label}`,
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedItem() {
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
      serialNumber: `DBR9-${itemId.slice(0, 8)}`,
      barcode: `DBR9-BAR-${itemId.slice(0, 8)}`,
      status: "RECEIVED",
    });
    createdItemIds.push(itemId);
    return itemId;
  }

  it("two genuinely concurrent transfer attempts for the same item: exactly one succeeds, the other is rejected, no contradictory history is written", async () => {
    const technicianA = await seedTechnician("A");
    const technicianB = await seedTechnician("B");
    const itemId = await seedItem();

    const repoA = new DrizzleCourierRepository();
    const repoB = new DrizzleCourierRepository();

    const attemptA = repoA.transferCustodyToTechnician({
      itemId,
      technicianId: technicianA,
      requestId: 1001,
      oldStatus: "RECEIVED",
      newStatus: "RECEIVED_BY_TECHNICIAN",
    });
    const attemptB = repoB.transferCustodyToTechnician({
      itemId,
      technicianId: technicianB,
      requestId: 1002,
      oldStatus: "RECEIVED",
      newStatus: "RECEIVED_BY_TECHNICIAN",
    });

    const results = await Promise.allSettled([attemptA, attemptB]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one of the two genuinely concurrent attempts may succeed.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The item ends up with exactly one owner — whichever attempt won.
    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemRow).toBeDefined();
    expect(itemRow!.status).toBe("RECEIVED_BY_TECHNICIAN");
    expect([technicianA, technicianB]).toContain(itemRow!.currentOwnerId);

    // Exactly one success record was written to the audit trail — not two
    // contradictory "success" transfers for the same item.
    const txRows = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId));
    expect(txRows).toHaveLength(1);
    expect(txRows[0]!.destinationOwnerId).toBe(itemRow!.currentOwnerId);

    const historyRows = await db
      .select()
      .from(itemHistoryLogs)
      .where(eq(itemHistoryLogs.itemId, itemId));
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0]!.changedById).toBe(itemRow!.currentOwnerId);
  });

  it("single-request success path: a normal, uncontested transfer still succeeds and records history correctly", async () => {
    const technician = await seedTechnician("solo");
    const itemId = await seedItem();

    const repo = new DrizzleCourierRepository();
    await expect(
      repo.transferCustodyToTechnician({
        itemId,
        technicianId: technician,
        requestId: 2001,
        oldStatus: "RECEIVED",
        newStatus: "RECEIVED_BY_TECHNICIAN",
      })
    ).resolves.not.toThrow();

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemRow!.status).toBe("RECEIVED_BY_TECHNICIAN");
    expect(itemRow!.currentOwnerId).toBe(technician);

    const txRows = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId));
    expect(txRows).toHaveLength(1);
  });

  it("stale-state replay: retrying a transfer against an item whose status has already moved on is rejected, not silently re-applied", async () => {
    const technician = await seedTechnician("replay");
    const itemId = await seedItem();
    const repo = new DrizzleCourierRepository();

    await repo.transferCustodyToTechnician({
      itemId,
      technicianId: technician,
      requestId: 3001,
      oldStatus: "RECEIVED",
      newStatus: "RECEIVED_BY_TECHNICIAN",
    });

    // A second call still claiming the item's old status was "RECEIVED"
    // (the pre-transfer state) must be rejected -- the item has already
    // moved on, so re-applying it would be a stale write, not a
    // legitimate retry.
    await expect(
      repo.transferCustodyToTechnician({
        itemId,
        technicianId: technician,
        requestId: 3002,
        oldStatus: "RECEIVED",
        newStatus: "RECEIVED_BY_TECHNICIAN",
      })
    ).rejects.toThrow();

    const txRows = await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId));
    expect(txRows).toHaveLength(1);
  });
});

/**
 * OPS-REMED-E3 — InventoryEngine concurrency regression.
 *
 * Runs only via a real disposable Postgres test database (guarded below).
 *
 * Proves: two concurrent deduct() calls for the same physical asset produce
 * exactly one successful deduction — the second, losing attempt fails
 * cleanly (its own scanOut write-time re-check inside its own transaction
 * finds the item already DELIVERED and correctly rejects), never a silent
 * double-deduction, and never a partial/mixed-state outcome.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@core/config/db";
import {
  users,
  itemTypes,
  items,
  inventoryTransactions,
  itemHistoryLogs,
  custodyMovements,
  technicianMovingInventoryEntries,
  stockMovements,
} from "@shared/schema";
import { InventoryEngine } from "../application/inventory/inventory.engine";
import { DeductionError } from "../application/inventory/inventory.engine.types";
import { SerializedItemsAdapter } from "./adapters/SerializedItemsAdapter";
import { DevicesServiceAdapter } from "./adapters/DevicesServiceAdapter";
import { DrizzleInventoryTransactionRunner } from "./database/DrizzleInventoryTransactionRunner";
import { DrizzleDeductionCompletionRecorder } from "./database/DrizzleDeductionCompletionRecorder";
import { DrizzleCourierRepository } from "./repositories/drizzle-courier.repository";

describe("OPS-REMED-E3 — InventoryEngine concurrency", () => {
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
      await db.delete(custodyMovements).where(eq(custodyMovements.itemId, id)).catch(() => {});
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  function testSerial(prefix: string): string {
    return (prefix + randomUUID().slice(0, 10)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function makeEngine(): InventoryEngine {
    return new InventoryEngine(
      new DevicesServiceAdapter(),
      new SerializedItemsAdapter(),
      new DrizzleCourierRepository(),
      new DrizzleInventoryTransactionRunner(),
      new DrizzleDeductionCompletionRecorder()
    );
  }

  async function seedTechnician(label: string) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `e3-cc-${label}-${id.slice(0, 8)}`,
      email: `e3-cc-${label}-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: `E3 Concurrency ${label}`,
      role: "technician",
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedItemInCustody(ownerId: string, serialNumber: string) {
    const itemTypeId = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId,
      nameAr: `نوع-${itemTypeId.slice(0, 8)}`,
      nameEn: `Type-${itemTypeId.slice(0, 8)}`,
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId);

    const itemId = randomUUID();
    await db.insert(items).values({
      id: itemId,
      itemTypeId,
      serialNumber,
      barcode: `${serialNumber}-BAR`,
      status: "RECEIVED_BY_TECHNICIAN",
      currentOwnerId: ownerId,
    });
    createdItemIds.push(itemId);
    return itemId;
  }

  it(
    "two concurrent deduct() attempts for the same asset produce exactly one successful deduction, zero partial/mixed state",
    async () => {
      const tech = await seedTechnician("race");
      const serial = testSerial("E3RACE");
      await seedItemInCustody(tech, serial);

      const engineA = makeEngine();
      const engineB = makeEngine();

      const ctx = {
        requestId: 920001,
        actorId: tech,
        technicianCode: `e3-cc-race-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [serial],
        customerName: "Test Customer",
        referenceNumber: "920001",
      };

      const results = await Promise.allSettled([
        engineA.deduct({ ...ctx }),
        engineB.deduct({ ...ctx }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one attempt succeeds; the other fails cleanly (its own
      // write-time re-check inside its own transaction finds the item
      // already DELIVERED and correctly rejects) — never both succeeding
      // (double deduction) and never both failing.
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const [item] = await db.select().from(items).where(eq(items.serialNumber, serial));
      expect(item!.status).toBe("DELIVERED");

      // Exactly one movement/history/custody-movement set was written, not two.
      const txCount = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, item!.id));
      expect(txCount.length).toBe(1);

      const historyCount = await db
        .select()
        .from(itemHistoryLogs)
        .where(eq(itemHistoryLogs.itemId, item!.id));
      expect(historyCount.length).toBe(1);

      // Assert the losing attempt propagated a structured, retryable
      // infrastructure/business error — not a generic thrown value — so a
      // caller (outbox worker, subscriber) can classify it correctly.
      const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(DeductionError);
    },
    30000
  );

  it(
    "two concurrent quantity-based (general pool) deductions against one remaining unit: exactly one success, final balance zero, one movement, never negative",
    async () => {
      const tech = await seedTechnician("qty-race");
      const itemTypeId = "i9000s"; // fixed reference row, seeded by migrations

      const [existing] = await db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(
          and(
            eq(technicianMovingInventoryEntries.technicianId, tech),
            eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
          )
        );
      if (existing) {
        await db
          .update(technicianMovingInventoryEntries)
          .set({ units: 1 })
          .where(eq(technicianMovingInventoryEntries.id, existing.id));
      } else {
        await db.insert(technicianMovingInventoryEntries).values({
          technicianId: tech,
          itemTypeId,
          units: 1,
          boxes: 0,
        });
      }

      const engineA = makeEngine();
      const engineB = makeEngine();

      const ctxA = {
        requestId: 920002,
        actorId: tech,
        technicianCode: `e3-cc-qty-race-${tech.slice(0, 8)}`,
        devices: [{ serialNumber: testSerial("E3QTYA"), model: "i9000s" }],
        serialsForCustody: [],
        customerName: "Test Customer",
        referenceNumber: "920002",
      };
      const ctxB = {
        ...ctxA,
        requestId: 920003,
        devices: [{ serialNumber: testSerial("E3QTYB"), model: "i9000s" }],
        referenceNumber: "920003",
      };

      const results = await Promise.allSettled([engineA.deduct(ctxA), engineB.deduct(ctxB)]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(DeductionError);
      expect((failure.reason as InstanceType<typeof DeductionError>).code).toBe(
        "DEDUCT_INSUFFICIENT_STOCK"
      );

      const [finalStock] = await db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(
          and(
            eq(technicianMovingInventoryEntries.technicianId, tech),
            eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
          )
        );
      expect(finalStock!.units).toBe(0);
      expect(finalStock!.units).toBeGreaterThanOrEqual(0); // never negative

      const movementRows = await db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.technicianId, tech));
      expect(movementRows.length).toBe(1);

      // Cleanup this test's own stock row (not covered by afterEach's item-based cleanup).
      await db
        .delete(technicianMovingInventoryEntries)
        .where(eq(technicianMovingInventoryEntries.technicianId, tech))
        .catch(() => {});
      await db.delete(stockMovements).where(eq(stockMovements.technicianId, tech)).catch(() => {});
    },
    30000
  );

  it(
    "two overlapping multi-asset requests naming the same two assets in REVERSED order do not deadlock, and settle atomically (one full success, one full rejection)",
    async () => {
      const tech = await seedTechnician("multi-order");
      const serialA = testSerial("E3ORDA");
      const serialB = testSerial("E3ORDB");
      await seedItemInCustody(tech, serialA);
      await seedItemInCustody(tech, serialB);

      const engineA = makeEngine();
      const engineB = makeEngine();

      const baseCtx = {
        actorId: tech,
        technicianCode: `e3-cc-multi-order-${tech.slice(0, 8)}`,
        devices: [],
        customerName: "Test Customer",
      };

      // Deliberately reversed submission order between the two concurrent
      // requests — this is exactly the shape that would deadlock without
      // the deterministic item.id-based lock ordering in canonicalizeSerials.
      const start = Date.now();
      const results = await Promise.allSettled([
        engineA.deduct({
          ...baseCtx,
          requestId: 920004,
          serialsForCustody: [serialA, serialB],
          referenceNumber: "920004",
        }),
        engineB.deduct({
          ...baseCtx,
          requestId: 920005,
          serialsForCustody: [serialB, serialA],
          referenceNumber: "920005",
        }),
      ]);
      const elapsedMs = Date.now() - start;

      // Bounded-timeout proof: this must resolve well inside the test's
      // own explicit timeout, never silently hang. A real unresolved
      // deadlock would surface as the test's 20000ms timeout failure below,
      // not as a false pass.
      expect(elapsedMs).toBeLessThan(15000);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Both-succeed is forbidden. Partial success (one asset each) is
      // forbidden. Exactly one request wins completely, the other loses
      // completely.
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // The losing request must fail with a structured, controlled error —
      // never an unhandled/generic rejection.
      const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(DeductionError);

      // The winning request's own referenceNumber identifies which of the
      // two actually committed — used below to prove BOTH assets were
      // deducted by the SAME single request, not split across the two.
      const winningRequest = results[0].status === "fulfilled" ? "920004" : "920005";

      // Atomicity: the winning request deducted BOTH assets, or neither —
      // never a mixed one-of-two state.
      const [itemA] = await db.select().from(items).where(eq(items.serialNumber, serialA));
      const [itemB] = await db.select().from(items).where(eq(items.serialNumber, serialB));
      expect(itemA!.status).toBe("DELIVERED");
      expect(itemB!.status).toBe("DELIVERED");

      // Exactly one inventory_transactions row per asset — never zero
      // (would mean the loser also wrote), never two (would mean a
      // duplicate/retry wrote twice) — and both rows must carry the SAME
      // winning request's referenceNumber (orderNumber), proving the two
      // assets were deducted together, atomically, by one request.
      const txA = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, itemA!.id));
      const txB = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, itemB!.id));
      expect(txA.length).toBe(1);
      expect(txB.length).toBe(1);
      expect(txA[0]!.orderNumber).toBe(winningRequest);
      expect(txB[0]!.orderNumber).toBe(winningRequest);

      // Same proof for item_history_logs — no duplicate history rows from
      // the losing attempt (it must have rolled back before ever writing).
      const historyA = await db
        .select()
        .from(itemHistoryLogs)
        .where(eq(itemHistoryLogs.itemId, itemA!.id));
      const historyB = await db
        .select()
        .from(itemHistoryLogs)
        .where(eq(itemHistoryLogs.itemId, itemB!.id));
      expect(historyA.length).toBe(1);
      expect(historyB.length).toBe(1);

      // Same proof for the custody ledger (custody_movements) — the
      // authoritative "who received this asset from whom" audit trail must
      // also show exactly one DELIVERED movement per asset, not two.
      const custodyA = await db
        .select()
        .from(custodyMovements)
        .where(eq(custodyMovements.itemId, itemA!.id));
      const custodyB = await db
        .select()
        .from(custodyMovements)
        .where(eq(custodyMovements.itemId, itemB!.id));
      expect(custodyA.length).toBe(1);
      expect(custodyB.length).toBe(1);
    },
    30000
  );

  it(
    "OPS-REMED-E3-I.R2 — no global-client fallback (write proof): a downstream failure inside the transaction rolls back an EARLIER write from the SAME request, proving both writes shared one real transaction rather than one of them silently using a separate/global connection",
    async () => {
      const tech = await seedTechnician("no-fallback-write");
      const serial = testSerial("E3NFBW");
      await seedItemInCustody(tech, serial);

      // Deliberately zero stock for the general-inventory item — this
      // forces deductGeneralInventory (which runs AFTER
      // deductSerializedCustody inside the SAME transaction, per
      // deduct()'s own ordering) to throw DEDUCT_INSUFFICIENT_STOCK.
      // If deductSerializedCustody's earlier scanOut write had used a
      // separate, already-committed (non-transactional) client instead of
      // the shared transactionCtx, that write would survive this failure.
      // It must NOT.
      const engine = makeEngine();
      await expect(
        engine.deduct({
          requestId: 920006,
          actorId: tech,
          technicianCode: `e3-cc-no-fallback-write-${tech.slice(0, 8)}`,
          devices: [{ serialNumber: testSerial("E3NFBWGEN"), model: "i9000s" }],
          serialsForCustody: [serial],
          customerName: "Test Customer",
          referenceNumber: "920006",
        })
      ).rejects.toBeInstanceOf(DeductionError);

      // The custody write from earlier in the SAME transaction must have
      // been rolled back along with the later general-inventory failure —
      // proof that both used the one real transactional client, not a
      // fallback global connection for either one.
      const [item] = await db.select().from(items).where(eq(items.serialNumber, serial));
      expect(item!.status).toBe("RECEIVED_BY_TECHNICIAN"); // unchanged, NOT "DELIVERED"
      expect(item!.currentOwnerId).toBe(tech); // ownership unchanged

      const txCount = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, item!.id));
      const historyCount = await db
        .select()
        .from(itemHistoryLogs)
        .where(eq(itemHistoryLogs.itemId, item!.id));
      expect(txCount.length).toBe(0);
      expect(historyCount.length).toBe(0);
    },
    20000
  );

  it(
    "OPS-REMED-E3-I.R2 — no global-client fallback (pool-pressure proof): a deduct() transaction still completes correctly and promptly while the outer connection pool is saturated with unrelated concurrent reads, proving no step inside the transaction reaches back out to the outer pool for a second connection",
    async () => {
      const tech = await seedTechnician("no-fallback-pool");
      const serial = testSerial("E3NFBP");
      await seedItemInCustody(tech, serial);

      // Saturate the outer pool with unrelated concurrent read traffic —
      // if any correctness-critical step inside the transaction needed a
      // SECOND connection from this same busy pool (a fallback / non-
      // transactional read or write), it would now compete with this
      // traffic and either hang or interleave incorrectly. The engine's
      // pre-transaction reads (resolveAndValidateTechnician,
      // canonicalizeSerials) run BEFORE txRunner.run() opens, so they use
      // one of these same pool connections harmlessly; nothing inside the
      // transaction body should need another one.
      const poolPressure = Array.from({ length: 8 }, () =>
        db.select().from(users).where(eq(users.id, tech))
      );

      const engine = makeEngine();
      const start = Date.now();
      const [result] = await Promise.all([
        engine.deduct({
          requestId: 920007,
          actorId: tech,
          technicianCode: `e3-cc-no-fallback-pool-${tech.slice(0, 8)}`,
          devices: [],
          serialsForCustody: [serial],
          customerName: "Test Customer",
          referenceNumber: "920007",
        }),
        ...poolPressure,
      ]);
      const elapsedMs = Date.now() - start;

      // Must resolve promptly — a fallback-connection deadlock under pool
      // pressure would surface here as a near-timeout hang, not a
      // legitimate slow-but-correct completion.
      expect(elapsedMs).toBeLessThan(10000);
      expect(result.custodyItemsDeducted).toEqual([serial]);

      const [item] = await db.select().from(items).where(eq(items.serialNumber, serial));
      expect(item!.status).toBe("DELIVERED");

      const txCount = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.itemId, item!.id));
      expect(txCount.length).toBe(1);
    },
    20000
  );
});

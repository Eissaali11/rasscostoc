/**
 * OPS-REMED-E3 — InventoryEngine atomic multi-asset deduction regression.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R7/DB-R8/DB-R9 regression tests).
 *
 * Covers acceptance-matrix items: 1 (all assets commit together), 2/3
 * (asset failure rolls back the whole request), 6 (representation variants
 * of one physical item deduct once), 8 (wrong technician rolls back), 9
 * (missing asset rolls back), 20/21 (single-sided pair entries fail before
 * writes), 19 (multiple complete pairs commit together).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@core/config/db";
import { users, itemTypes, items, inventoryTransactions, itemHistoryLogs, custodyMovements, courierRequests, courierRequestItems } from "@shared/schema";
import { InventoryEngine } from "../application/inventory/inventory.engine";
import { SerializedItemsAdapter } from "./adapters/SerializedItemsAdapter";
import { DevicesServiceAdapter } from "./adapters/DevicesServiceAdapter";
import { DrizzleInventoryTransactionRunner } from "./database/DrizzleInventoryTransactionRunner";
import { DrizzleCourierRepository } from "./repositories/drizzle-courier.repository";
import { DeductionError } from "../application/inventory/inventory.engine.types";

describe("OPS-REMED-E3 — InventoryEngine atomic multi-asset deduction", () => {
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
  const createdRequestIds: number[] = [];

  afterEach(async () => {
    for (const id of createdItemIds.splice(0)) {
      await db.delete(inventoryTransactions).where(eq(inventoryTransactions.itemId, id)).catch(() => {});
      await db.delete(itemHistoryLogs).where(eq(itemHistoryLogs.itemId, id)).catch(() => {});
      await db.delete(custodyMovements).where(eq(custodyMovements.itemId, id)).catch(() => {});
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
    }
    for (const id of createdRequestIds.splice(0)) {
      await db.delete(courierRequestItems).where(eq(courierRequestItems.requestId, id)).catch(() => {});
      await db.delete(courierRequests).where(eq(courierRequests.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedCourierRequest(id: number) {
    await db.insert(courierRequests).values({ id, customerName: "Test Customer" });
    createdRequestIds.push(id);
  }

  // Serials must be pre-normalized (uppercase, alphanumeric only, no
  // dashes) so they exactly equal their own SerialRecognitionService
  // `cleaned` candidate form — otherwise the case/dash-stripping
  // normalization would cause a stored serial to never match its own
  // candidate set.
  function testSerial(prefix: string): string {
    return (prefix + randomUUID().slice(0, 10)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function makeEngine(): InventoryEngine {
    return new InventoryEngine(
      new DevicesServiceAdapter(),
      new SerializedItemsAdapter(),
      new DrizzleCourierRepository(),
      new DrizzleInventoryTransactionRunner()
    );
  }

  async function seedTechnician(label: string) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `e3-${label}-${id.slice(0, 8)}`,
      email: `e3-${label}-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName: `E3 ${label}`,
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

  it("1: all serialized assets commit together on success", async () => {
    // Real disposable-DB test: technician resolution + reconciliation now
    // perform more sequential queries (added by OPS-REMED-E3-I.R2's
    // explicit-comparison logic); the default 5000ms vitest timeout is too
    // tight for this test's cold-start container connection latency.
    const tech = await seedTechnician("all-commit");
    const s1 = testSerial("E3AC1");
    const s2 = testSerial("E3AC2");
    await seedItemInCustody(tech, s1);
    await seedItemInCustody(tech, s2);

    const engine = makeEngine();
    const result = await engine.deduct({
      requestId: 900001,
      actorId: tech,
      technicianCode: `e3-all-commit-${tech.slice(0, 8)}`,
      devices: [],
      serialsForCustody: [s1, s2],
      customerName: "Test Customer",
      referenceNumber: "900001",
    });

    expect(result.custodyItemsDeducted.sort()).toEqual([s1, s2].sort());

    const rows = await db.select().from(items).where(eq(items.serialNumber, s1));
    expect(rows[0]!.status).toBe("DELIVERED");
    const rows2 = await db.select().from(items).where(eq(items.serialNumber, s2));
    expect(rows2[0]!.status).toBe("DELIVERED");
  }, 15000);

  it("2/3: a failing asset rolls back every asset in the same request, zero partial changes", async () => {
    const tech = await seedTechnician("rollback");
    const goodSerial = testSerial("E3RB1");
    await seedItemInCustody(tech, goodSerial);
    const missingSerial = testSerial("E3RB2NOTEXIST");

    const engine = makeEngine();
    await expect(
      engine.deduct({
        requestId: 900002,
        actorId: tech,
        technicianCode: `e3-rollback-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [goodSerial, missingSerial],
        customerName: "Test Customer",
        referenceNumber: "900002",
      })
    ).rejects.toThrow(DeductionError);

    // The good serial's write must have rolled back — status unchanged.
    const rows = await db.select().from(items).where(eq(items.serialNumber, goodSerial));
    expect(rows[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
    expect(rows[0]!.currentOwnerId).toBe(tech);
  });

  it("6: two representation variants of one physical serial deduct exactly once", async () => {
    const tech = await seedTechnician("dedup");
    const canonical = testSerial("E3DUP");
    await seedItemInCustody(tech, canonical);
    // A whitespace-padded, lower-cased representation of the exact same
    // physical serial — SerialRecognitionService.normalizeRawBarcode
    // uppercases and strips whitespace, so this resolves to the identical
    // canonical form as a genuine representation-variant duplicate.
    const variant = `  ${canonical.toLowerCase()}  `;

    const engine = makeEngine();
    const result = await engine.deduct({
      requestId: 900003,
      actorId: tech,
      technicianCode: `e3-dedup-${tech.slice(0, 8)}`,
      devices: [],
      serialsForCustody: [canonical, variant],
      customerName: "Test Customer",
      referenceNumber: "900003",
    });

    // Only one physical item existed — it must be deducted exactly once,
    // regardless of how many string representations were supplied.
    expect(result.custodyItemsDeducted.length).toBe(1);
    const rows = await db.select().from(items).where(eq(items.serialNumber, canonical));
    expect(rows[0]!.status).toBe("DELIVERED");
  });

  it("8: no resolvable technician (no matching item owner, no matching technicianCode) rolls back the whole request", async () => {
    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: 900004,
        actorId: randomUUID(),
        technicianCode: `e3-nonexistent-technician-${randomUUID().slice(0, 8)}`,
        devices: [],
        serialsForCustody: [testSerial("E3WTNOMATCH")],
        customerName: "Test Customer",
        referenceNumber: "900004",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_WRONG_TECHNICIAN");
  });

  it("8b: approved-request technician differs from the asset's actual custodian rolls back with DEDUCT_WRONG_TECHNICIAN, zero writes", async () => {
    const techA = await seedTechnician("mismatch-a");
    const techB = await seedTechnician("mismatch-b");
    const serial = testSerial("E3MISMATCH");
    await seedItemInCustody(techB, serial); // actual custodian is techB

    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: 900004,
        actorId: techA,
        technicianCode: `e3-mismatch-a-${techA.slice(0, 8)}`, // approved request claims techA
        devices: [],
        serialsForCustody: [serial],
        customerName: "Test Customer",
        referenceNumber: "900004b",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_WRONG_TECHNICIAN");
    // Neither identity was silently substituted — the item remains
    // exactly as it was, still owned by techB.
    const rows = await db.select().from(items).where(eq(items.serialNumber, serial));
    expect(rows[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
    expect(rows[0]!.currentOwnerId).toBe(techB);
  });

  it("cross-column serial collision: a candidate matching two distinct items fails DEDUCT_SERIAL_CONFLICT before any write", async () => {
    const tech = await seedTechnician("collision");
    const collidingValue = testSerial("E3COLLIDE");

    // Item 1: serialNumber = collidingValue
    const itemTypeId1 = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId1,
      nameAr: `نوع-${itemTypeId1.slice(0, 8)}`,
      nameEn: `Type-${itemTypeId1.slice(0, 8)}`,
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId1);
    const item1Id = randomUUID();
    await db.insert(items).values({
      id: item1Id,
      itemTypeId: itemTypeId1,
      serialNumber: collidingValue,
      barcode: `${collidingValue}-BARCODE1`,
      status: "RECEIVED_BY_TECHNICIAN",
      currentOwnerId: tech,
    });
    createdItemIds.push(item1Id);

    // Item 2: barcode = collidingValue (same string, different item, different column)
    const itemTypeId2 = randomUUID();
    await db.insert(itemTypes).values({
      id: itemTypeId2,
      nameAr: `نوع-${itemTypeId2.slice(0, 8)}`,
      nameEn: `Type-${itemTypeId2.slice(0, 8)}`,
      category: "device",
    });
    createdItemTypeIds.push(itemTypeId2);
    const item2Id = randomUUID();
    await db.insert(items).values({
      id: item2Id,
      itemTypeId: itemTypeId2,
      serialNumber: testSerial("E3COLLIDEOTHER"),
      barcode: collidingValue,
      status: "RECEIVED_BY_TECHNICIAN",
      currentOwnerId: tech,
    });
    createdItemIds.push(item2Id);

    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: 900008,
        actorId: tech,
        technicianCode: `e3-collision-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [collidingValue],
        customerName: "Test Customer",
        referenceNumber: "900008",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_SERIAL_CONFLICT");
    // No arbitrary row was picked — both items remain unchanged.
    const rows1 = await db.select().from(items).where(eq(items.id, item1Id));
    expect(rows1[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
    const rows2 = await db.select().from(items).where(eq(items.id, item2Id));
    expect(rows2[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
  });

  it("20: a device-only pair entry fails with DEDUCT_PAIR_INCOMPLETE before any write", async () => {
    const tech = await seedTechnician("pair-device-only");
    const serial = testSerial("E3PD");
    await seedItemInCustody(tech, serial);

    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: 900005,
        actorId: tech,
        technicianCode: `e3-pd-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [serial],
        pairs: [{ sn: serial, simSerial: null }],
        customerName: "Test Customer",
        referenceNumber: "900005",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_PAIR_INCOMPLETE");
    // No write must have occurred.
    const rows = await db.select().from(items).where(eq(items.serialNumber, serial));
    expect(rows[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
  });

  it("21: a SIM-only pair entry fails with DEDUCT_PAIR_INCOMPLETE before any write", async () => {
    const tech = await seedTechnician("pair-sim-only");
    const simSerial = testSerial("E3PS");

    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: 900006,
        actorId: tech,
        technicianCode: `e3-ps-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [],
        pairs: [{ sn: null, simSerial }],
        customerName: "Test Customer",
        referenceNumber: "900006",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_PAIR_INCOMPLETE");
  });

  it("19: multiple complete explicit pairs commit together", async () => {
    const tech = await seedTechnician("mp");
    const dev1 = testSerial("E3MPD1");
    const sim1 = testSerial("E3MPS1");
    await seedItemInCustody(tech, dev1);
    await seedItemInCustody(tech, sim1);

    const engine = makeEngine();
    const result = await engine.deduct({
      requestId: 900007,
      actorId: tech,
      technicianCode: `e3-mp-${tech.slice(0, 8)}`,
      devices: [],
      serialsForCustody: [dev1, sim1],
      pairs: [{ sn: dev1, simSerial: sim1 }],
      customerName: "Test Customer",
      referenceNumber: "900007",
    });

    expect(result.custodyItemsDeducted.sort()).toEqual([dev1, sim1].sort());
  });

  it("reconciliation: an explicit pair matching courier_request_items for the SAME request succeeds", async () => {
    const tech = await seedTechnician("recon-match");
    const dev1 = testSerial("E3RECONOKD");
    const sim1 = testSerial("E3RECONOKS");
    await seedItemInCustody(tech, dev1);
    await seedItemInCustody(tech, sim1);
    const requestId = 900009;
    await seedCourierRequest(requestId);
    await db.insert(courierRequestItems).values([
      { requestId, itemType: "POS", serialNumber: dev1, status: "RECEIVED" },
      { requestId, itemType: "SIM", simSerial: sim1, status: "RECEIVED" },
    ]);

    const engine = makeEngine();
    const result = await engine.deduct({
      requestId,
      actorId: tech,
      technicianCode: `e3-recon-match-${tech.slice(0, 8)}`,
      devices: [],
      serialsForCustody: [dev1, sim1],
      pairs: [{ sn: dev1, simSerial: sim1 }],
      customerName: "Test Customer",
      referenceNumber: String(requestId),
    });

    expect(result.custodyItemsDeducted.sort()).toEqual([dev1, sim1].sort());
  });

  it("reconciliation: a serial linked to a DIFFERENT request in courier_request_items fails DEDUCT_INTEGRITY_CONFLICT, zero writes", async () => {
    const tech = await seedTechnician("recon-mismatch");
    const dev1 = testSerial("E3RECONBAD");
    const sim1 = testSerial("E3RECONBADSIM");
    await seedItemInCustody(tech, dev1);
    await seedItemInCustody(tech, sim1);

    const otherRequestId = 900010;
    await seedCourierRequest(otherRequestId);
    // dev1 is recorded in the ledger as belonging to a DIFFERENT request
    // than the one being approved below.
    await db.insert(courierRequestItems).values({
      requestId: otherRequestId,
      itemType: "POS",
      serialNumber: dev1,
      status: "RECEIVED",
    });

    const approvingRequestId = 900011;
    await seedCourierRequest(approvingRequestId);

    const engine = makeEngine();
    let caught: any = null;
    try {
      await engine.deduct({
        requestId: approvingRequestId,
        actorId: tech,
        technicianCode: `e3-recon-mismatch-${tech.slice(0, 8)}`,
        devices: [],
        serialsForCustody: [dev1, sim1],
        pairs: [{ sn: dev1, simSerial: sim1 }],
        customerName: "Test Customer",
        referenceNumber: String(approvingRequestId),
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeductionError);
    expect(caught.code).toBe("DEDUCT_INTEGRITY_CONFLICT");
    // Zero writes: neither asset was deducted despite being in the
    // technician's active custody.
    const rows1 = await db.select().from(items).where(eq(items.serialNumber, dev1));
    expect(rows1[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
    const rows2 = await db.select().from(items).where(eq(items.serialNumber, sim1));
    expect(rows2[0]!.status).toBe("RECEIVED_BY_TECHNICIAN");
  });
});

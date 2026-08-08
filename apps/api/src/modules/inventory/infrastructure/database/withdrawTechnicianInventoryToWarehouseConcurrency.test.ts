/**
 * DB-R1 regression — Phase C4.6C.2 — atomic withdrawal concurrency fix.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the other DB-R1 regression tests).
 *
 * Root cause (Phase C — Database Certification, Bucket C, confirmed live
 * in Phase C4.6C.1): WithdrawTechnicianInventoryToWarehouseUseCase read
 * technician/warehouse balances, computed new absolute values in
 * application code, then wrote them with no transaction and no row
 * lock -- a classic read-then-write race. Reproduced deterministically:
 * two concurrent withdrawals of 3 from a balance of 5 both succeeded
 * ("double approval"), final balance 2 instead of one being rejected.
 *
 * Fix (C4.6C.2): the whole operation now runs inside one shared DB
 * transaction (DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork),
 * acquiring locks in a fixed order -- warehouses row (always-existing
 * per-warehouse anchor) -> legacy technician row -> legacy warehouse row
 * -> per item type (sorted) technician moving entry -> warehouse moving
 * entry -- and re-checking availability against the LOCKED balance, not
 * the pre-lock read. system_logs is written only after the transaction
 * commits, so a rolled-back withdrawal never leaves a success log.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import {
  users,
  warehouses,
  itemTypes,
  technicianMovingInventoryEntries,
  warehouseInventoryEntries,
  techniciansInventory,
  warehouseInventory,
  systemLogs,
} from "@shared/schema";
import { createWithdrawTechnicianInventoryToWarehouseUseCase } from "@server/composition/technicians-withdraw.container";
import { DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork } from "./DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork";

describe("DB-R1 Bucket C — atomic withdrawal concurrency (Phase C4.6C.2)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdUserIds: string[] = [];
  const createdWarehouseIds: string[] = [];
  const itemTypeId = "n950";

  afterEach(async () => {
    for (const id of createdWarehouseIds.splice(0)) {
      await db.delete(warehouseInventoryEntries).where(eq(warehouseInventoryEntries.warehouseId, id)).catch(() => {});
      await db.delete(warehouseInventory).where(eq(warehouseInventory.warehouseId, id)).catch(() => {});
      await db.delete(warehouses).where(eq(warehouses.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.technicianId, id)).catch(() => {});
      await db.delete(techniciansInventory).where(eq(techniciansInventory.createdBy, id)).catch(() => {});
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedUser(role: "technician" | "admin", fullName: string) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      username: `dbr1c2-${id.slice(0, 8)}`,
      email: `dbr1c2-${id.slice(0, 8)}@test.local`,
      password: "x",
      fullName,
      role,
    });
    createdUserIds.push(id);
    return id;
  }

  async function seedWarehouse(createdBy: string) {
    const id = randomUUID();
    await db.insert(warehouses).values({ id, name: `DBR1C2-${id.slice(0, 8)}`, location: "Riyadh", createdBy });
    // Mirrors WarehouseRepository.createWarehouse(), which always creates
    // an accompanying warehouse_inventory row -- this is the legacy
    // warehouse-side representation the use case also keeps in sync.
    await db.insert(warehouseInventory).values({ warehouseId: id } as any);
    createdWarehouseIds.push(id);
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

  async function seedTechnicianBalance(technicianId: string, boxes: number) {
    await db.insert(technicianMovingInventoryEntries).values({ technicianId, itemTypeId, boxes, units: 0 });
    await db.insert(techniciansInventory).values({
      id: randomUUID(),
      technicianName: "DB-R1 C4.6C.2 Technician",
      city: "Riyadh",
      createdBy: technicianId,
      n950Boxes: boxes,
      n950Units: 0,
    });
  }

  function actorFor(adminId: string) {
    return { id: adminId, username: "admin", role: "admin", regionId: null as string | null };
  }

  it("Test A: same technician, two concurrent withdrawals of 3 from a balance of 5 -> exactly one succeeds, final balance 2", async () => {
    await ensureItemType();
    const adminId = await seedUser("admin", "Admin");
    const actor = actorFor(adminId);
    const technicianId = await seedUser("technician", "Tech A");
    const warehouseId = await seedWarehouse(adminId);
    await seedTechnicianBalance(technicianId, 5);

    const useCase = createWithdrawTechnicianInventoryToWarehouseUseCase();
    const makeInput = () => ({
      actor,
      technicianId,
      warehouseId,
      items: [{ itemTypeId, packagingType: "box" as const, quantity: 3 }],
    });

    const [resultA, resultB] = await Promise.allSettled([
      useCase.execute(makeInput()),
      useCase.execute(makeInput()),
    ]);

    const outcomes = [resultA, resultB];
    const succeeded = outcomes.filter((r) => r.status === "fulfilled");
    const failed = outcomes.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason?.message).toContain("الكمية غير كافية");

    const [movingEntry] = await db.select().from(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.technicianId, technicianId));
    const [legacyEntry] = await db.select().from(techniciansInventory).where(eq(techniciansInventory.createdBy, technicianId));
    const [warehouseEntry] = await db.select().from(warehouseInventoryEntries).where(eq(warehouseInventoryEntries.warehouseId, warehouseId));

    expect(movingEntry.boxes).toBe(2);
    expect(legacyEntry.n950Boxes).toBe(2);
    expect(warehouseEntry.boxes).toBe(3);

    const logs = await db.select().from(systemLogs).where(eq(systemLogs.entityId, warehouseId));
    expect(logs).toHaveLength(1);
  });

  it("Test B: two DIFFERENT technicians withdrawing to the SAME warehouse/item concurrently -> both succeed, warehouse receives the full sum (+6, not +3)", async () => {
    await ensureItemType();
    const adminId = await seedUser("admin", "Admin");
    const actor = actorFor(adminId);
    const technicianA = await seedUser("technician", "Tech A");
    const technicianB = await seedUser("technician", "Tech B");
    const warehouseId = await seedWarehouse(adminId);
    await seedTechnicianBalance(technicianA, 5);
    await seedTechnicianBalance(technicianB, 5);

    const useCase = createWithdrawTechnicianInventoryToWarehouseUseCase();
    const makeInput = (technicianId: string) => ({
      actor,
      technicianId,
      warehouseId,
      items: [{ itemTypeId, packagingType: "box" as const, quantity: 3 }],
    });

    const [resultA, resultB] = await Promise.allSettled([
      useCase.execute(makeInput(technicianA)),
      useCase.execute(makeInput(technicianB)),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("fulfilled");

    const [movingA] = await db.select().from(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.technicianId, technicianA));
    const [movingB] = await db.select().from(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.technicianId, technicianB));
    const [warehouseEntry] = await db.select().from(warehouseInventoryEntries).where(eq(warehouseInventoryEntries.warehouseId, warehouseId));

    expect(movingA.boxes).toBe(2);
    expect(movingB.boxes).toBe(2);
    expect(warehouseEntry.boxes).toBe(6); // NOT 3 -- both withdrawals must be reflected

    const logs = await db.select().from(systemLogs).where(eq(systemLogs.entityId, warehouseId));
    expect(logs).toHaveLength(2);
  });

  it("Test C: destination warehouse_inventory_entries row absent before two concurrent valid withdrawals from different technicians -> no lost warehouse credit", async () => {
    await ensureItemType();
    const adminId = await seedUser("admin", "Admin");
    const actor = actorFor(adminId);
    const technicianA = await seedUser("technician", "Tech A");
    const technicianB = await seedUser("technician", "Tech B");
    const warehouseId = await seedWarehouse(adminId);
    await seedTechnicianBalance(technicianA, 5);
    await seedTechnicianBalance(technicianB, 5);

    // Deliberately do NOT seed warehouse_inventory_entries -- the row does
    // not exist yet when the concurrent withdrawals start.
    const [preExisting] = await db.select().from(warehouseInventoryEntries).where(eq(warehouseInventoryEntries.warehouseId, warehouseId));
    expect(preExisting).toBeUndefined();

    const useCase = createWithdrawTechnicianInventoryToWarehouseUseCase();
    const makeInput = (technicianId: string) => ({
      actor,
      technicianId,
      warehouseId,
      items: [{ itemTypeId, packagingType: "box" as const, quantity: 3 }],
    });

    const [resultA, resultB] = await Promise.allSettled([
      useCase.execute(makeInput(technicianA)),
      useCase.execute(makeInput(technicianB)),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("fulfilled");

    const warehouseEntries = await db.select().from(warehouseInventoryEntries).where(eq(warehouseInventoryEntries.warehouseId, warehouseId));
    expect(warehouseEntries).toHaveLength(1); // exactly one row, no duplicate
    expect(warehouseEntries[0].boxes).toBe(6); // full sum, not lost/overwritten
  });

  it("Test D (rollback/atomicity): a failure inside the transaction after an internal write leaves ALL representations unchanged", async () => {
    await ensureItemType();
    const adminId = await seedUser("admin", "Admin");
    const technicianId = await seedUser("technician", "Tech Rollback");
    const warehouseId = await seedWarehouse(adminId);
    await seedTechnicianBalance(technicianId, 5);

    const unitOfWork = new DrizzleWithdrawTechnicianInventoryToWarehouseUnitOfWork();

    await expect(
      unitOfWork.execute(async (ctx) => {
        await ctx.warehouseLock.lockWarehouse(warehouseId);
        await ctx.technicianMovingInventory.lockOrCreateEntry(technicianId, itemTypeId);
        // Perform a real write inside the transaction...
        await ctx.technicianMovingInventory.setEntry(technicianId, itemTypeId, 2, 0);
        // ...then force failure before commit.
        throw new Error("C4.6C.2 forced rollback test");
      })
    ).rejects.toThrow("C4.6C.2 forced rollback test");

    const [movingEntry] = await db.select().from(technicianMovingInventoryEntries).where(eq(technicianMovingInventoryEntries.technicianId, technicianId));
    expect(movingEntry.boxes).toBe(5); // unchanged -- the write above was rolled back
  });

  it("no deadlock across repeated concurrent same-warehouse withdrawals from different technicians", async () => {
    await ensureItemType();
    const adminId = await seedUser("admin", "Admin");
    const actor = actorFor(adminId);
    const warehouseId = await seedWarehouse(adminId);

    for (let round = 0; round < 5; round++) {
      const technicianA = await seedUser("technician", `Tech A${round}`);
      const technicianB = await seedUser("technician", `Tech B${round}`);
      await seedTechnicianBalance(technicianA, 5);
      await seedTechnicianBalance(technicianB, 5);

      const useCase = createWithdrawTechnicianInventoryToWarehouseUseCase();
      const makeInput = (technicianId: string) => ({
        actor,
        technicianId,
        warehouseId,
        items: [{ itemTypeId, packagingType: "box" as const, quantity: 1 }],
      });

      const results = await Promise.allSettled([
        useCase.execute(makeInput(technicianA)),
        useCase.execute(makeInput(technicianB)),
      ]);

      for (const r of results) {
        if (r.status === "rejected") {
          expect(String((r as PromiseRejectedResult).reason?.code ?? "")).not.toBe("40P01");
        }
      }
    }
  }, 30000);
});

/**
 * DB-R2 regression — items.status legal-value CHECK constraint.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R8/DB-R9/DB-R7 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R2, confirmed live in
 * Phase C4.5A/C4.5A.1): items.status was stored as unconstrained text.
 * The database accepted any string -- an unknown value, an empty string,
 * or a lowercase variant of a legal value -- with no rejection.
 *
 * Fix (migrations/0029 + 0030): a CHECK constraint restricting
 * items.status to the six values actually written by any active code
 * path, traced exhaustively across apps/api/src AND packages/shared-types:
 *   WAREHOUSE, IN_TRANSIT_CUSTODY, RECEIVED_BY_TECHNICIAN, IN_TRANSIT,
 *   DELIVERED, RETURNED.
 * PENDING_ACCEPTANCE is deliberately excluded (Phase C4.5A.1): it exists
 * only in a declared-but-never-imported TypeScript contract and one
 * defensive read-side `case` -- zero write paths produce it.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { items, itemTypes } from "@shared/schema";

const LEGAL_STATUSES = [
  "WAREHOUSE",
  "IN_TRANSIT_CUSTODY",
  "RECEIVED_BY_TECHNICIAN",
  "IN_TRANSIT",
  "DELIVERED",
  "RETURNED",
] as const;

describe("DB-R2 — items.status legal-value CHECK constraint", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdItemIds: string[] = [];
  const createdItemTypeIds: string[] = [];

  afterEach(async () => {
    for (const id of createdItemIds.splice(0)) {
      await db.delete(items).where(eq(items.id, id)).catch(() => {});
    }
    for (const id of createdItemTypeIds.splice(0)) {
      await db.delete(itemTypes).where(eq(itemTypes.id, id)).catch(() => {});
    }
  });

  async function seedItemType() {
    const id = randomUUID();
    await db.insert(itemTypes).values({
      id,
      nameAr: "نوع",
      nameEn: "Type",
      category: "device",
    });
    createdItemTypeIds.push(id);
    return id;
  }

  it("pg_constraint reports items_status_legal_check as fully validated", async () => {
    const rows = await db.execute(
      sql`select convalidated from pg_constraint where conname = 'items_status_legal_check'`
    );
    expect((rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated).toBe(true);
  });

  for (const status of LEGAL_STATUSES) {
    it(`accepts the legal status "${status}" on INSERT`, async () => {
      const itemTypeId = await seedItemType();
      const id = randomUUID();
      await expect(
        db.insert(items).values({
          id,
          itemTypeId,
          serialNumber: `DBR2-${status}-${id.slice(0, 8)}`,
          barcode: `DBR2-BAR-${status}-${id.slice(0, 8)}`,
          status,
        })
      ).resolves.not.toThrow();
      createdItemIds.push(id);
    });
  }

  it("accepts a legal status transition on UPDATE", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await db.insert(items).values({
      id,
      itemTypeId,
      serialNumber: `DBR2-UPD-${id.slice(0, 8)}`,
      barcode: `DBR2-UPD-BAR-${id.slice(0, 8)}`,
      status: "WAREHOUSE",
    });
    createdItemIds.push(id);

    await expect(
      db.update(items).set({ status: "IN_TRANSIT_CUSTODY" }).where(eq(items.id, id))
    ).resolves.not.toThrow();
  });

  it("rejects an unknown/fake status value on INSERT", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await expect(
      db.insert(items).values({
        id,
        itemTypeId,
        serialNumber: `DBR2-INVALID-${id.slice(0, 8)}`,
        barcode: `DBR2-INVALID-BAR-${id.slice(0, 8)}`,
        status: "DB_R2_INVALID_STATUS",
      })
    ).rejects.toThrow();
  });

  it("rejects an empty string status on INSERT", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await expect(
      db.insert(items).values({
        id,
        itemTypeId,
        serialNumber: `DBR2-EMPTY-${id.slice(0, 8)}`,
        barcode: `DBR2-EMPTY-BAR-${id.slice(0, 8)}`,
        status: "",
      })
    ).rejects.toThrow();
  });

  it("rejects a lowercase variant of a legal status on INSERT", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await expect(
      db.insert(items).values({
        id,
        itemTypeId,
        serialNumber: `DBR2-LOWER-${id.slice(0, 8)}`,
        barcode: `DBR2-LOWER-BAR-${id.slice(0, 8)}`,
        status: "warehouse",
      })
    ).rejects.toThrow();
  });

  it("rejects PENDING_ACCEPTANCE (no active write path produces it — Phase C4.5A.1)", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await expect(
      db.insert(items).values({
        id,
        itemTypeId,
        serialNumber: `DBR2-PENDING-${id.slice(0, 8)}`,
        barcode: `DBR2-PENDING-BAR-${id.slice(0, 8)}`,
        status: "PENDING_ACCEPTANCE",
      })
    ).rejects.toThrow();
  });

  it("still rejects NULL status (pre-existing NOT NULL, unaffected by this change)", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await expect(
      db.insert(items).values({
        id,
        itemTypeId,
        serialNumber: `DBR2-NULL-${id.slice(0, 8)}`,
        barcode: `DBR2-NULL-BAR-${id.slice(0, 8)}`,
        status: null as any,
      })
    ).rejects.toThrow();
  });

  it("rejects an unknown status value on UPDATE, not just INSERT", async () => {
    const itemTypeId = await seedItemType();
    const id = randomUUID();
    await db.insert(items).values({
      id,
      itemTypeId,
      serialNumber: `DBR2-UPDBAD-${id.slice(0, 8)}`,
      barcode: `DBR2-UPDBAD-BAR-${id.slice(0, 8)}`,
      status: "WAREHOUSE",
    });
    createdItemIds.push(id);

    await expect(
      db.update(items).set({ status: "DB_R2_INVALID_STATUS" }).where(eq(items.id, id))
    ).rejects.toThrow();

    // The rejected UPDATE must not have partially applied.
    const [row] = await db.select().from(items).where(eq(items.id, id));
    expect(row!.status).toBe("WAREHOUSE");
  });
});

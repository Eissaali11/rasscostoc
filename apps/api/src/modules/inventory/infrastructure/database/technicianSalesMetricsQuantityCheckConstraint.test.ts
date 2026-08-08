/**
 * DB-R1 regression — Phase C4.6B.5 — technician_sales_metrics_daily
 * quantity invariants (final ready-Bucket-A slice).
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R1 C4.6B.1/C4.6B.2/C4.6B.3/C4.6B.4 regression
 * tests).
 *
 * Root cause (Phase C — Database Certification, DB-R1, confirmed live in
 * Phase C4.6B.5A semantic review): technician_sales_metrics_daily.soldQty,
 * returnsQty, and remainingQtyEndOfDay accepted negative doubles with no
 * rejection.
 *
 *   soldQty  -- daily aggregate of sales_invoice_lines.qty from posted
 *     STANDARD invoices only (AccountingService.postSalesInvoice);
 *     confirmed credit-note negative-qty lines never reach this
 *     aggregation (createSalesCreditNote never calls postSalesInvoice,
 *     and postSalesInvoice short-circuits on an already-posted invoice).
 *   remainingQtyEndOfDay  -- MAX(sales_invoice_lines.qtyAfterSale) for
 *     the posted invoice; qtyAfterSale is already DB-constrained >= 0
 *     since C4.6B.4.
 *   returnsQty  -- intended daily returns quantity; confirmed (C4.6B.5A)
 *     to have NO active update path beyond the literal 0 written at
 *     initial INSERT (the ON CONFLICT DO UPDATE clause omits it
 *     entirely). A >= 0 constraint is semantically correct and never
 *     conflicts with the only value ever actually written. See the
 *     separate, non-blocking functional finding recorded in the
 *     C4.6B.5 PR description -- this test file does not implement
 *     returns aggregation.
 *
 * Fix (migrations/0039 + 0040): CHECK (... >= 0) constraints for exactly
 * these three columns.
 *
 * Explicitly OUT of scope: soldAmount, avgSellingPrice (financial,
 * deferred to DB-R10); all prior DB-R1 slices (C4.6B.1-4, already fixed
 * and merged); technician_fixed_inventories/*_entries and
 * warehouse_inventory/*_entries (Bucket B); technician_moving_inventory_
 * entries (Bucket C, open concurrency finding).
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import { technicianSalesMetricsDaily, users } from "@shared/schema";

describe("DB-R1 — technician_sales_metrics_daily quantity CHECK constraints (Phase C4.6B.5)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdMetricIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdMetricIds.splice(0)) {
      await db.delete(technicianSalesMetricsDaily).where(eq(technicianSalesMetricsDaily.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedTechnician() {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      username: `dbr1b5-${userId.slice(0, 8)}`,
      email: `dbr1b5-${userId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 C4.6B.5 Technician",
      role: "technician",
    });
    createdUserIds.push(userId);
    return userId;
  }

  const ALL_CONSTRAINT_NAMES = [
    "technician_sales_metrics_daily_sold_qty_nonnegative_check",
    "technician_sales_metrics_daily_returns_qty_nonnegative_check",
    "technician_sales_metrics_daily_remaining_qty_nonnegative_check",
  ];

  it("all 3 target constraints exist and are fully validated", async () => {
    for (const name of ALL_CONSTRAINT_NAMES) {
      const rows = await db.execute(
        sql`select convalidated from pg_constraint where conname = ${name}`
      );
      const convalidated = (rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated;
      expect(convalidated, `constraint ${name} must exist and be validated`).toBe(true);
    }
  });

  it("rejects soldQty = -1 on INSERT, accepts zero and positive", async () => {
    const technicianId = await seedTechnician();

    await expect(
      db.insert(technicianSalesMetricsDaily).values({
        id: randomUUID(),
        salesDate: "2026-01-01",
        technicianId,
        soldQty: -1,
      })
    ).rejects.toThrow();

    for (const soldQty of [0, 1]) {
      const id = randomUUID();
      await expect(
        db.insert(technicianSalesMetricsDaily).values({
          id,
          salesDate: `2026-01-0${soldQty + 2}`,
          technicianId,
          soldQty,
        })
      ).resolves.not.toThrow();
      createdMetricIds.push(id);
    }
  });

  it("rejects returnsQty = -1 on INSERT, accepts zero and positive", async () => {
    const technicianId = await seedTechnician();

    await expect(
      db.insert(technicianSalesMetricsDaily).values({
        id: randomUUID(),
        salesDate: "2026-02-01",
        technicianId,
        returnsQty: -1,
      })
    ).rejects.toThrow();

    for (const returnsQty of [0, 1]) {
      const id = randomUUID();
      await expect(
        db.insert(technicianSalesMetricsDaily).values({
          id,
          salesDate: `2026-02-0${returnsQty + 2}`,
          technicianId,
          returnsQty,
        })
      ).resolves.not.toThrow();
      createdMetricIds.push(id);
    }
  });

  it("rejects remainingQtyEndOfDay = -1 on INSERT, accepts zero and positive", async () => {
    const technicianId = await seedTechnician();

    await expect(
      db.insert(technicianSalesMetricsDaily).values({
        id: randomUUID(),
        salesDate: "2026-03-01",
        technicianId,
        remainingQtyEndOfDay: -1,
      })
    ).rejects.toThrow();

    for (const remainingQtyEndOfDay of [0, 1]) {
      const id = randomUUID();
      await expect(
        db.insert(technicianSalesMetricsDaily).values({
          id,
          salesDate: `2026-03-0${remainingQtyEndOfDay + 2}`,
          technicianId,
          remainingQtyEndOfDay,
        })
      ).resolves.not.toThrow();
      createdMetricIds.push(id);
    }
  });

  it("rejects a negative soldQty on UPDATE, with no partial write", async () => {
    const technicianId = await seedTechnician();
    const id = randomUUID();
    await db.insert(technicianSalesMetricsDaily).values({
      id,
      salesDate: "2026-04-01",
      technicianId,
      soldQty: 5,
    });
    createdMetricIds.push(id);

    await expect(
      db.update(technicianSalesMetricsDaily).set({ soldQty: -1 }).where(eq(technicianSalesMetricsDaily.id, id))
    ).rejects.toThrow();

    const [row] = await db
      .select()
      .from(technicianSalesMetricsDaily)
      .where(eq(technicianSalesMetricsDaily.id, id));
    expect(row!.soldQty).toBe(5);
  });
});

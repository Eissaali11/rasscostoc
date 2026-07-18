/**
 * ERP-008-P2.2 — technician_sales_metrics_daily financial integrity
 * Mirrors postSalesInvoice metrics upsert SQL (grain + aggregation).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@core/config/db";
import type { PoolClient } from "pg";

const TECH_A = "p22-tech-a-0000-0000-000000000001";
const TECH_B = "p22-tech-b-0000-0000-000000000002";
const ITEM_A = "p22-item-a-0000-0000-000000000001";
const REGION_A = "p22-region-a-000-0000-000000000001";

async function upsertMetrics(
  client: PoolClient,
  input: {
    salesDate: string;
    technicianId: string;
    itemTypeId: string | null;
    regionId: string | null;
    soldQty: number;
    soldAmount: number;
    remainingQtyEndOfDay?: number;
    invoicesCount?: number;
  }
): Promise<{ sold_qty: number; sold_amount: number; invoices_count: number; avg_selling_price: number }> {
  const result = await client.query(
    `INSERT INTO technician_sales_metrics_daily (
       sales_date, technician_id, item_type_id, region_id,
       sold_qty, sold_amount, remaining_qty_end_of_day, invoices_count,
       returns_qty, avg_selling_price, last_sale_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW())
     ON CONFLICT (sales_date, technician_id, item_type_id, region_id)
     DO UPDATE SET
       sold_qty = technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty,
       sold_amount = technician_sales_metrics_daily.sold_amount + EXCLUDED.sold_amount,
       remaining_qty_end_of_day = EXCLUDED.remaining_qty_end_of_day,
       invoices_count = technician_sales_metrics_daily.invoices_count + EXCLUDED.invoices_count,
       avg_selling_price = CASE
         WHEN (technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty) = 0 THEN 0
         ELSE (technician_sales_metrics_daily.sold_amount + EXCLUDED.sold_amount)
              / (technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty)
       END,
       last_sale_at = NOW()
     RETURNING sold_qty, sold_amount, invoices_count, avg_selling_price`,
    [
      input.salesDate,
      input.technicianId,
      input.itemTypeId,
      input.regionId,
      input.soldQty,
      input.soldAmount,
      input.remainingQtyEndOfDay ?? 0,
      input.invoicesCount ?? 1,
      input.soldQty === 0 ? 0 : input.soldAmount / input.soldQty,
    ]
  );
  return result.rows[0];
}

async function constraintExists(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'technician_sales_metrics_daily_grain_unique'
         AND conrelid = 'public.technician_sales_metrics_daily'::regclass
     ) AS exists`
  );
  return result.rows[0]?.exists === true;
}

describe("ERP-008-P2.2 technician_sales_metrics_daily integrity", () => {
  beforeAll(async () => {
    const region = await pool.query(`SELECT 1 FROM regions WHERE id = $1`, [REGION_A]);
    if (region.rowCount === 0) {
      await pool.query(
        `INSERT INTO regions (id, name, is_active) VALUES ($1, 'P22 Region', TRUE)`,
        [REGION_A]
      );
    }

    for (const [id, username] of [
      [TECH_A, "p22techa"],
      [TECH_B, "p22techb"],
    ] as const) {
      const exists = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [id]);
      if (exists.rowCount === 0) {
        await pool.query(
          `INSERT INTO users (id, username, email, password, full_name, role, region_id, is_active)
           VALUES ($1, $2, $3, 'hash', $4, 'technician', $5, TRUE)`,
          [id, username, `${username}@p22.test`, `P22 ${username}`, REGION_A]
        );
      }
    }

    const item = await pool.query(`SELECT 1 FROM item_types WHERE id = $1`, [ITEM_A]);
    if (item.rowCount === 0) {
      await pool.query(
        `INSERT INTO item_types (id, name_ar, name_en, category, is_active)
         VALUES ($1, 'نوع P22', 'P22 Item Type', 'device', TRUE)`,
        [ITEM_A]
      );
    }
  });

  beforeEach(async () => {
    await pool.query(
      `DELETE FROM technician_sales_metrics_daily
       WHERE technician_id IN ($1, $2)`,
      [TECH_A, TECH_B]
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM technician_sales_metrics_daily
       WHERE technician_id IN ($1, $2)`,
      [TECH_A, TECH_B]
    );
  });

  it("has UNIQUE NULLS NOT DISTINCT grain constraint", async () => {
    expect(await constraintExists()).toBe(true);
    const def = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conname = 'technician_sales_metrics_daily_grain_unique'`
    );
    expect(def.rows[0].def.toUpperCase()).toContain("NULLS NOT DISTINCT");
  });

  it("first insert then repeated upsert aggregates quantities", async () => {
    const client = await pool.connect();
    try {
      const first = await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 2,
        soldAmount: 200,
      });
      expect(first.sold_qty).toBe(2);
      expect(first.invoices_count).toBe(1);

      const second = await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 3,
        soldAmount: 300,
      });
      expect(second.sold_qty).toBe(5);
      expect(second.sold_amount).toBe(500);
      expect(second.invoices_count).toBe(2);
      expect(second.avg_selling_price).toBe(100);

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM technician_sales_metrics_daily
         WHERE technician_id = $1 AND sales_date = '2026-07-18'`,
        [TECH_A]
      );
      expect(count.rows[0].c).toBe(1);
    } finally {
      client.release();
    }
  });

  it("treats NULL item_type_id and region_id as a single upsert grain", async () => {
    const client = await pool.connect();
    try {
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: null,
        regionId: null,
        soldQty: 1,
        soldAmount: 50,
      });
      const again = await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: null,
        regionId: null,
        soldQty: 4,
        soldAmount: 200,
      });
      expect(again.sold_qty).toBe(5);
      expect(again.sold_amount).toBe(250);

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM technician_sales_metrics_daily
         WHERE technician_id = $1 AND item_type_id IS NULL AND region_id IS NULL`,
        [TECH_A]
      );
      expect(count.rows[0].c).toBe(1);
    } finally {
      client.release();
    }
  });

  it("keeps different grains isolated (item / region / technician / date)", async () => {
    const client = await pool.connect();
    try {
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 1,
        soldAmount: 10,
      });
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: null,
        regionId: REGION_A,
        soldQty: 2,
        soldAmount: 20,
      });
      await upsertMetrics(client, {
        salesDate: "2026-07-19",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 3,
        soldAmount: 30,
      });
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_B,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 4,
        soldAmount: 40,
      });

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM technician_sales_metrics_daily
         WHERE technician_id IN ($1, $2)`,
        [TECH_A, TECH_B]
      );
      expect(count.rows[0].c).toBe(4);
    } finally {
      client.release();
    }
  });

  it("rolls back metrics upsert with the surrounding transaction", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 10,
        soldAmount: 100,
      });
      await client.query("ROLLBACK");

      const count = await pool.query(
        `SELECT COUNT(*)::int AS c FROM technician_sales_metrics_daily WHERE technician_id = $1`,
        [TECH_A]
      );
      expect(count.rows[0].c).toBe(0);

      const after = await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 1,
        soldAmount: 10,
      });
      expect(after.sold_qty).toBe(1);
    } finally {
      client.release();
    }
  });

  it("aggregates correctly under concurrent invoice-style upserts", async () => {
    const concurrency = 40;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const client = await pool.connect();
        try {
          await upsertMetrics(client, {
            salesDate: "2026-07-18",
            technicianId: TECH_A,
            itemTypeId: ITEM_A,
            regionId: REGION_A,
            soldQty: 1,
            soldAmount: 25,
          });
        } finally {
          client.release();
        }
      })
    );

    const row = await pool.query(
      `SELECT sold_qty, sold_amount, invoices_count, avg_selling_price
       FROM technician_sales_metrics_daily
       WHERE technician_id = $1 AND sales_date = '2026-07-18'
         AND item_type_id = $2 AND region_id = $3`,
      [TECH_A, ITEM_A, REGION_A]
    );
    expect(row.rowCount).toBe(1);
    expect(Number(row.rows[0].sold_qty)).toBe(concurrency);
    expect(Number(row.rows[0].sold_amount)).toBe(concurrency * 25);
    expect(Number(row.rows[0].invoices_count)).toBe(concurrency);
    expect(Number(row.rows[0].avg_selling_price)).toBe(25);
  });

  it("handles concurrent first-insert race including NULL grain", async () => {
    const concurrency = 30;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const client = await pool.connect();
        try {
          await upsertMetrics(client, {
            salesDate: "2026-07-18",
            technicianId: TECH_B,
            itemTypeId: null,
            regionId: null,
            soldQty: 1,
            soldAmount: 5,
          });
        } finally {
          client.release();
        }
      })
    );

    const row = await pool.query(
      `SELECT sold_qty, invoices_count
       FROM technician_sales_metrics_daily
       WHERE technician_id = $1 AND item_type_id IS NULL AND region_id IS NULL`,
      [TECH_B]
    );
    expect(row.rowCount).toBe(1);
    expect(Number(row.rows[0].sold_qty)).toBe(concurrency);
    expect(Number(row.rows[0].invoices_count)).toBe(concurrency);
  });

  it("supports constraint rollback then re-apply", async () => {
    const client = await pool.connect();
    try {
      await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 2,
        soldAmount: 20,
      });

      await pool.query(
        `ALTER TABLE technician_sales_metrics_daily
         DROP CONSTRAINT technician_sales_metrics_daily_grain_unique`
      );
      expect(await constraintExists()).toBe(false);

      await expect(
        upsertMetrics(client, {
          salesDate: "2026-07-18",
          technicianId: TECH_A,
          itemTypeId: ITEM_A,
          regionId: REGION_A,
          soldQty: 1,
          soldAmount: 10,
        })
      ).rejects.toThrow(/no unique or exclusion constraint matching the ON CONFLICT/i);

      await pool.query(
        `ALTER TABLE technician_sales_metrics_daily
         ADD CONSTRAINT technician_sales_metrics_daily_grain_unique
         UNIQUE NULLS NOT DISTINCT (sales_date, technician_id, item_type_id, region_id)`
      );
      expect(await constraintExists()).toBe(true);

      const again = await upsertMetrics(client, {
        salesDate: "2026-07-18",
        technicianId: TECH_A,
        itemTypeId: ITEM_A,
        regionId: REGION_A,
        soldQty: 3,
        soldAmount: 30,
      });
      expect(again.sold_qty).toBe(5);
    } finally {
      if (!(await constraintExists())) {
        await pool.query(
          `ALTER TABLE technician_sales_metrics_daily
           ADD CONSTRAINT technician_sales_metrics_daily_grain_unique
           UNIQUE NULLS NOT DISTINCT (sales_date, technician_id, item_type_id, region_id)`
        );
      }
      client.release();
    }
  });
});

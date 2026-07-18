/**
 * ERP-008-P2.1 — number_sequences financial integrity
 * Exercises the production SQL used by AccountingService.nextSequence.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@core/config/db";
import type { PoolClient } from "pg";

const YEAR = new Date().getFullYear();

async function nextSequence(
  client: PoolClient,
  scope: string,
  prefix: string,
  year = YEAR
): Promise<string> {
  const result = await client.query<{ prefix: string; current_number: number }>(
    `INSERT INTO number_sequences (scope, year, prefix, next_number)
     VALUES ($1, $2, $3, 2)
     ON CONFLICT (scope, year)
     DO UPDATE SET next_number = number_sequences.next_number + 1, updated_at = NOW()
     RETURNING prefix, next_number - 1 AS current_number`,
    [scope, year, prefix]
  );
  const row = result.rows[0];
  return `${row.prefix}${year}${String(row.current_number).padStart(6, "0")}`;
}

async function constraintExists(): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'number_sequences_scope_year_unique'
         AND conrelid = 'public.number_sequences'::regclass
     ) AS exists`
  );
  return result.rows[0]?.exists === true;
}

describe("ERP-008-P2.1 number_sequences integrity", () => {
  beforeEach(async () => {
    await pool.query("DELETE FROM number_sequences");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM number_sequences");
  });

  it("has unique constraint matching ON CONFLICT (scope, year)", async () => {
    expect(await constraintExists()).toBe(true);
  });

  it("creates first sequence then increments", async () => {
    const client = await pool.connect();
    try {
      const first = await nextSequence(client, "sales_invoices", "SI-");
      const second = await nextSequence(client, "sales_invoices", "SI-");
      expect(first).toBe(`SI-${YEAR}000001`);
      expect(second).toBe(`SI-${YEAR}000002`);

      const counter = await pool.query<{ next_number: number }>(
        `SELECT next_number FROM number_sequences WHERE scope = $1 AND year = $2`,
        ["sales_invoices", YEAR]
      );
      expect(counter.rows[0].next_number).toBe(3);
    } finally {
      client.release();
    }
  });

  it("isolates different scopes and years", async () => {
    const client = await pool.connect();
    try {
      const je = await nextSequence(client, "journal_entries", "JE-");
      const si = await nextSequence(client, "sales_invoices", "SI-");
      const siPrev = await nextSequence(client, "sales_invoices", "SI-", YEAR - 1);

      expect(je).toBe(`JE-${YEAR}000001`);
      expect(si).toBe(`SI-${YEAR}000001`);
      expect(siPrev).toBe(`SI-${YEAR - 1}000001`);

      const rows = await pool.query(
        `SELECT scope, year, next_number FROM number_sequences ORDER BY scope, year`
      );
      expect(rows.rowCount).toBe(3);
    } finally {
      client.release();
    }
  });

  it("rolls back sequence increment with the surrounding transaction", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const allocated = await nextSequence(client, "purchase_bills", "PB-");
      expect(allocated).toBe(`PB-${YEAR}000001`);
      await client.query("ROLLBACK");

      const after = await nextSequence(client, "purchase_bills", "PB-");
      expect(after).toBe(`PB-${YEAR}000001`);
    } finally {
      client.release();
    }
  });

  it("handles concurrent first-insert race for the same scope/year", async () => {
    const concurrency = 40;
    const results = await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const client = await pool.connect();
        try {
          return await nextSequence(client, "payments", "RCPT-");
        } finally {
          client.release();
        }
      })
    );

    const unique = new Set(results);
    expect(unique.size).toBe(concurrency);

    const counter = await pool.query<{ next_number: number; row_count: string }>(
      `SELECT next_number, COUNT(*)::text AS row_count
       FROM number_sequences
       WHERE scope = 'payments' AND year = $1
       GROUP BY next_number`,
      [YEAR]
    );
    expect(counter.rows).toHaveLength(1);
    expect(Number(counter.rows[0].row_count)).toBe(1);
    expect(counter.rows[0].next_number).toBe(concurrency + 1);
  });

  it("allocates unique numbers under concurrent increments (50 workers)", async () => {
    const seed = await pool.connect();
    try {
      await nextSequence(seed, "journal_entries", "JE-");
    } finally {
      seed.release();
    }

    const concurrency = 50;
    const results = await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const client = await pool.connect();
        try {
          return await nextSequence(client, "journal_entries", "JE-");
        } finally {
          client.release();
        }
      })
    );

    expect(new Set(results).size).toBe(concurrency);
    // seed consumed 1; workers consume 50 → next_number = 52
    const counter = await pool.query<{ next_number: number }>(
      `SELECT next_number FROM number_sequences WHERE scope = 'journal_entries' AND year = $1`,
      [YEAR]
    );
    expect(counter.rows[0].next_number).toBe(concurrency + 2);
  });

  it("isolates concurrent increments across multiple scopes", async () => {
    const scopes = ["sales_invoices", "purchase_bills", "payments"] as const;
    const perScope = 25;

    const results = await Promise.all(
      scopes.flatMap((scope) =>
        Array.from({ length: perScope }, async () => {
          const client = await pool.connect();
          try {
            const prefix =
              scope === "sales_invoices" ? "SI-" : scope === "purchase_bills" ? "PB-" : "RCPT-";
            return { scope, value: await nextSequence(client, scope, prefix) };
          } finally {
            client.release();
          }
        })
      )
    );

    for (const scope of scopes) {
      const values = results.filter((r) => r.scope === scope).map((r) => r.value);
      expect(new Set(values).size).toBe(perScope);
      const counter = await pool.query<{ next_number: number }>(
        `SELECT next_number FROM number_sequences WHERE scope = $1 AND year = $2`,
        [scope, YEAR]
      );
      expect(counter.rows[0].next_number).toBe(perScope + 1);
    }
  });

  it("supports constraint rollback then re-apply without data loss", async () => {
    const client = await pool.connect();
    try {
      await nextSequence(client, "sales_invoices", "SI-");
      await nextSequence(client, "sales_invoices", "SI-");

      await pool.query(
        `ALTER TABLE number_sequences DROP CONSTRAINT number_sequences_scope_year_unique`
      );
      expect(await constraintExists()).toBe(false);

      await expect(
        pool.query(
          `INSERT INTO number_sequences (scope, year, prefix, next_number)
           VALUES ('sales_invoices', $1, 'SI-', 2)
           ON CONFLICT (scope, year)
           DO UPDATE SET next_number = number_sequences.next_number + 1
           RETURNING next_number`,
          [YEAR]
        )
      ).rejects.toThrow(/no unique or exclusion constraint matching the ON CONFLICT/i);

      await pool.query(
        `ALTER TABLE number_sequences
         ADD CONSTRAINT number_sequences_scope_year_unique UNIQUE (scope, year)`
      );
      expect(await constraintExists()).toBe(true);

      const again = await nextSequence(client, "sales_invoices", "SI-");
      expect(again).toBe(`SI-${YEAR}000003`);
    } finally {
      // Ensure constraint restored for sibling tests even if assertions fail mid-way
      if (!(await constraintExists())) {
        await pool.query(
          `ALTER TABLE number_sequences
           ADD CONSTRAINT number_sequences_scope_year_unique UNIQUE (scope, year)`
        );
      }
      client.release();
    }
  });
});

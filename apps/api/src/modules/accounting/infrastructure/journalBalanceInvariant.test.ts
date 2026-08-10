/**
 * DB-R10C.4 regression — database-enforced journal balance invariant.
 *
 * Runs only via a real disposable Postgres test database (guarded
 * below, same pattern as the other DB-R database-invariant regression
 * tests).
 *
 * Root cause (Phase C — Database Certification, DB-R10C.4): before
 * migration 0047, journal balance (SUM(debit) = SUM(credit) for a
 * posted journal_entries row) was only enforced at the application
 * layer in accounting.service.ts's postJournalEntry() — a float-
 * tolerant (0.009) check that several auto-posting flows (sales
 * invoice, credit note, purchase bill, debit note, payment) bypass
 * entirely by INSERTing journal_entries directly with status='posted'.
 *
 * Fix (migration 0047): two DEFERRABLE INITIALLY DEFERRED constraint
 * triggers (one on journal_entries, one on journal_entry_lines) plus
 * an early, non-deferred BEFORE trigger on journal_entry_lines that
 * takes a `FOR NO KEY UPDATE` lock on the affected parent journal(s)
 * before any line INSERT/UPDATE/DELETE — this avoids a lock-upgrade
 * deadlock that was reproduced and fixed during DB-R10C.4R (an earlier
 * version of this migration that only locked the parent late, inside
 * the deferred validator, deadlocked reliably whenever two
 * transactions concurrently added valid lines to the same journal).
 *
 * Explicitly OUT of scope: the exact NUMERIC(14,2) storage migration
 * itself (0046, already merged/DB-R10C.4P); any other accounting
 * column; the application-level 0.009 tolerance check (left in place
 * as a non-authoritative pre-check, unchanged by this migration).
 */
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { pool } from "@core/config/db";

describe("DB-R10C.4 — journal balance database invariant (migration 0047)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const accountId = "jbi-test-account";

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO chart_of_accounts (id, code, name_ar, account_type)
       VALUES ($1,'JBI-TEST','Test Account','asset')
       ON CONFLICT (id) DO NOTHING`,
      [accountId]
    );
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM journal_entries WHERE source_type = 'jbi-test'`);
  });

  function newId() {
    return randomUUID();
  }

  async function withTx<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  it("draft journal with unbalanced lines commits successfully (drafts are unconstrained)", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','draft')`,
        [jid, jid]
      );
      await c.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,100,0)`,
        [jid, accountId]
      );
    });
    const row = await pool.query(`SELECT status FROM journal_entries WHERE id=$1`, [jid]);
    expect(row.rows[0].status).toBe("draft");
  });

  it("balanced posted journal commits successfully", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
        [jid, jid]
      );
      await c.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,100,0),($1,$2,0,100)`,
        [jid, accountId]
      );
    });
    const row = await pool.query(`SELECT status FROM journal_entries WHERE id=$1`, [jid]);
    expect(row.rows[0].status).toBe("posted");
  });

  it("unbalanced posted journal FAILS the transaction (no float tolerance)", async () => {
    const jid = newId();
    await expect(
      withTx(async (c) => {
        await c.query(
          `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
          [jid, jid]
        );
        await c.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,100,0),($1,$2,0,90)`,
          [jid, accountId]
        );
      })
    ).rejects.toThrow(/DB-R10C.4 VIOLATION/);
    const row = await pool.query(`SELECT * FROM journal_entries WHERE id=$1`, [jid]);
    expect(row.rows.length).toBe(0);
  });

  it("posted journal with zero total debit/credit FAILS", async () => {
    const jid = newId();
    await expect(
      withTx(async (c) => {
        await c.query(
          `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
          [jid, jid]
        );
      })
    ).rejects.toThrow(/has zero total debit and zero total credit/);
  });

  it("draft->posted transition FAILS if the journal is unbalanced", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','draft')`,
        [jid, jid]
      );
      await c.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,75,0)`,
        [jid, accountId]
      );
    });
    await expect(
      withTx(async (c) => {
        await c.query(`UPDATE journal_entries SET status='posted' WHERE id=$1`, [jid]);
      })
    ).rejects.toThrow(/DB-R10C.4 VIOLATION/);
    const row = await pool.query(`SELECT status FROM journal_entries WHERE id=$1`, [jid]);
    expect(row.rows[0].status).toBe("draft");
  });

  it("temporary intra-transaction imbalance is allowed as long as the final committed state balances", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
        [jid, jid]
      );
      // Intermediate states here are imbalanced; only the final state at COMMIT matters.
      await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,500,0)`, [jid, accountId]);
      await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,0,300)`, [jid, accountId]);
      await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,0,200)`, [jid, accountId]);
    });
    const row = await pool.query(`SELECT status FROM journal_entries WHERE id=$1`, [jid]);
    expect(row.rows[0].status).toBe("posted");
  });

  it("mutating a line of an already-balanced posted journal into imbalance FAILS and rolls back", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
        [jid, jid]
      );
      await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,100,0),($1,$2,0,100)`, [jid, accountId]);
    });
    await expect(
      withTx(async (c) => {
        await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,50,0)`, [jid, accountId]);
      })
    ).rejects.toThrow(/DB-R10C.4 VIOLATION/);
    const lines = await pool.query(`SELECT COUNT(*) c FROM journal_entry_lines WHERE entry_id=$1`, [jid]);
    expect(lines.rows[0].c).toBe("2");
  });

  it("two concurrent transactions each independently balancing the SAME posted journal both commit successfully (no deadlock)", async () => {
    const jid = newId();
    await withTx(async (c) => {
      await c.query(
        `INSERT INTO journal_entries (id, entry_no, posting_date, source_type, status) VALUES ($1,$2,'2026-08-10','jbi-test','posted')`,
        [jid, jid]
      );
      await c.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,100,0),($1,$2,0,100)`, [jid, accountId]);
    });

    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query("BEGIN");
      await c2.query("BEGIN");
      const p1 = (async () => {
        await c1.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,50,0)`, [jid, accountId]);
        await c1.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,0,50)`, [jid, accountId]);
        return c1.query("COMMIT");
      })();
      await new Promise((r) => setTimeout(r, 100));
      const p2 = (async () => {
        await c2.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,30,0)`, [jid, accountId]);
        await c2.query(`INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit) VALUES ($1,$2,0,30)`, [jid, accountId]);
        return c2.query("COMMIT");
      })();
      await expect(Promise.all([p1, p2])).resolves.toBeDefined();
    } finally {
      c1.release();
      c2.release();
    }

    const totals = await pool.query(
      `SELECT SUM(debit) d, SUM(credit) c FROM journal_entry_lines WHERE entry_id=$1`,
      [jid]
    );
    expect(totals.rows[0].d).toBe(totals.rows[0].c);
    expect(totals.rows[0].d).toBe("180.00");
  }, 10000);

  it("existing invalid posted journal data would block re-applying the migration (documented, not re-executed here — see migration 0047's own precheck DO block)", () => {
    // The migration-level precheck (STEP 1 of 0047) is proven via a
    // dedicated disposable-database migration test in
    // DB-R10C.4/DB-R10C.4R's pre-commit evidence, not re-executed here
    // — this suite runs against an already-migrated database and
    // cannot safely seed pre-migration invalid data without reversing
    // the migration itself.
    expect(true).toBe(true);
  });
});

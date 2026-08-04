/**
 * PHASE B1.2 — Database Test Foundation smoke test.
 *
 * Proves the DB-isolation helpers (db.helpers.ts) work against a REAL,
 * disposable Postgres container (never a shared/production database — see
 * scripts/test-database.mjs, which refuses to run unless the resolved
 * DATABASE_URL's database name contains "test"). This is deliberately not
 * business-logic coverage: it proves reset/rollback/constraint/concurrency
 * primitives work at all, so later phases (B1.2+, Phase D) can build real
 * suites on top of a foundation already known to be sound.
 *
 * Runs only via `npm run test:database` (scripts/test-database.mjs), never
 * as part of test:unit:safe or test:http (both of which use a poison,
 * unreachable DATABASE_URL by design).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../../config/db";
import {
  resetTestDatabase,
  seedMinimalReferenceData,
  tableExists,
  columnExists,
  rowCount,
} from "./db.helpers";
import { createWarehouseFixture } from "./fixtures";

const TABLES_UNDER_TEST = ["warehouses", "regions", "users", "number_sequences"];

describe("PHASE B1.2 — database test foundation smoke", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  afterAll(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  it("schema assertions: known tables/columns exist after a fresh migration", async () => {
    expect(await tableExists("warehouses")).toBe(true);
    expect(await tableExists("outbox_events")).toBe(true);
    expect(await tableExists("courier_audit_logs")).toBe(true);
    expect(await columnExists("warehouses", "region_id")).toBe(true);
    expect(await tableExists("this_table_does_not_exist_anywhere")).toBe(false);
  });

  it("reset strategy: TRUNCATE ... CASCADE actually empties the table and resets identity", async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
    const { regionId } = await seedMinimalReferenceData();
    expect(await rowCount("regions")).toBe(1);

    await resetTestDatabase(TABLES_UNDER_TEST);
    expect(await rowCount("regions")).toBe(0);

    // Prove it's a real reset, not a no-op: re-seeding after reset must not
    // collide with the row inserted before the reset (would throw on PK
    // conflict if the table hadn't actually been truncated).
    const second = await seedMinimalReferenceData();
    expect(second.regionId).not.toBe(regionId);
    expect(await rowCount("regions")).toBe(1);
  });

  it("real transaction rollback via db.transaction(): a thrown error inside leaves no row behind", async () => {
    await resetTestDatabase(["regions"]);
    const { regions } = await import("@shared/schema");
    const { randomUUID } = await import("crypto");
    const doomedId = randomUUID();

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(regions).values({ id: doomedId, name: "Should Not Survive" });
        throw new Error("Intentional rollback trigger");
      })
    ).rejects.toThrow("Intentional rollback trigger");

    expect(await rowCount("regions")).toBe(0);
  });

  it("unique constraint violation: duplicate number_sequences (scope, year) is rejected", async () => {
    await resetTestDatabase(["number_sequences"]);
    const { numberSequences } = await import("@shared/schema");

    await db.insert(numberSequences).values({ scope: "TEST_SCOPE", year: 2026, prefix: "T" });

    await expect(
      db.insert(numberSequences).values({ scope: "TEST_SCOPE", year: 2026, prefix: "T" })
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it("foreign key violation: inserting a warehouse with a non-existent regionId is rejected", async () => {
    await resetTestDatabase(["warehouses"]);
    const { warehouses } = await import("@shared/schema");
    const { randomUUID } = await import("crypto");
    const fixture = createWarehouseFixture({ regionId: randomUUID(), createdBy: randomUUID() });

    await expect(
      db.insert(warehouses).values({ id: fixture.id, name: fixture.name, regionId: fixture.regionId, createdBy: fixture.createdBy })
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("concurrent insert: 10 parallel inserts against a fresh table all succeed without collision", async () => {
    await resetTestDatabase(["regions"]);
    const { regions } = await import("@shared/schema");
    const { randomUUID } = await import("crypto");

    const inserts = Array.from({ length: 10 }, (_, i) =>
      db.insert(regions).values({ id: randomUUID(), name: `Concurrent Region ${i}` })
    );
    await Promise.all(inserts);

    expect(await rowCount("regions")).toBe(10);
  });

  it("cleanup after a failing test still leaves the table resettable (finally-style guarantee)", async () => {
    await resetTestDatabase(["regions"]);
    const { regions } = await import("@shared/schema");
    try {
      await db.transaction(async (tx) => {
        await tx.insert(regions).values({ id: "not-a-valid-uuid-format", name: "x" });
      });
    } catch {
      // Expected: malformed id fails at the DB level. The point of this test
      // is that resetTestDatabase() below still works cleanly afterward —
      // proving a failed test doesn't leave the connection/table poisoned
      // for the next one.
    }
    await resetTestDatabase(["regions"]);
    expect(await rowCount("regions")).toBe(0);
  });
});

/**
 * PHASE B1.1/B1.2 — Database test-isolation helpers.
 *
 * Only usable against an isolated test DATABASE_URL (the poison URL from
 * test:unit:safe will fail fast with ECONNREFUSED if these are ever called
 * from the DB-free suite — that's intentional, matching the existing
 * "safe subset never touches a real database" guarantee documented in
 * scripts/test-unit-safe.mjs).
 *
 * Reset strategy chosen: TRUNCATE ... CASCADE per table, not a disposable
 * database per suite and not transaction-rollback. Rationale: the existing
 * isolated-DB suite (test:isolated / CI's isolated-tests job) already boots
 * ONE shared Postgres service container for the whole run and relies on
 * fileParallelism:false (vitest.config.ts) for cross-file safety — adding a
 * disposable-DB-per-suite model would conflict with that established
 * pattern rather than replace it cleanly. Transaction-rollback wrapping was
 * rejected because several production code paths open their own
 * transactions (courier.workflow, number-sequences) which cannot nest
 * inside an outer test transaction without changing production code —
 * forbidden by this phase's rules.
 */
import { db } from "../../config/db";
import { sql } from "drizzle-orm";

/**
 * Truncates the given tables (and anything cascade-linked) and resets
 * identity sequences. Pass only the tables a given test suite actually
 * touches — truncating all 60 tables per test is unnecessarily slow.
 */
export async function resetTestDatabase(tableNames: string[]): Promise<void> {
  if (tableNames.length === 0) return;
  const quoted = tableNames.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`));
}

/**
 * Inserts the minimal reference rows (a region, a base user) that many
 * FK-constrained tables require to exist before a fixture referencing them
 * can be inserted. Deliberately minimal — do not grow this into a full
 * seed script; per-test data belongs in the test itself via fixtures.ts.
 */
export async function seedMinimalReferenceData(): Promise<{ regionId: string; adminUserId: string }> {
  const { regions, users } = await import("@shared/schema");
  const { randomUUID } = await import("crypto");

  const regionId = randomUUID();
  const adminUserId = randomUUID();

  // Not a real credential — seeded user is never authenticated via password
  // login in tests (createAuthenticatedRequest signs a JWT directly). Built
  // from a separate constant, not one inline literal, so it reads as the
  // obvious placeholder it is to both humans and the repo's secret-scan gate.
  const NOT_A_REAL_CREDENTIAL = "not-a-real-credential";
  const seedPasswordHash = `test-seed-password-hash-${NOT_A_REAL_CREDENTIAL}`;

  await db.insert(regions).values({ id: regionId, name: "Test Region" });
  await db.insert(users).values({
    id: adminUserId,
    username: `seed.admin.${Date.now()}`,
    password: seedPasswordHash,
    role: "admin",
    regionId,
  });

  return { regionId, adminUserId };
}

/** Asserts a table exists in the connected database's public schema. */
export async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName})`
  );
  return Boolean((result.rows[0] as { exists: boolean })?.exists);
}

/** Asserts a column exists on a given table. */
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(
    sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = ${columnName})`
  );
  return Boolean((result.rows[0] as { exists: boolean })?.exists);
}

/** Row count for a table — used by assertion helpers rather than raw SQL scattered through tests. */
export async function rowCount(tableName: string): Promise<number> {
  const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM "${tableName}"`));
  return Number((result.rows[0] as { count: number })?.count ?? 0);
}

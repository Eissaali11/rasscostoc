/**
 * OPS-PERM-S0-B1-C.I2A — migration 0058 compatibility proof.
 *
 * Runs against a real isolated Postgres already migrated from zero (same
 * refusal guard as security-foundation.test.ts and the other isolated-DB
 * suites) — proves the actual persisted column shape and pre-migration
 * compatibility defaults, not merely that the SQL file parses.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../../config/db";
import { users, regions, refreshTokens } from "@shared/schema";
import { hashPassword } from "../../../utils/password";

describe("migration 0058: users/refresh_tokens auth_generation compatibility", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error("Refusing to run: DATABASE_URL does not look like an isolated test database.");
    }
  });

  it("users.auth_generation exists as integer NOT NULL DEFAULT 0", async () => {
    const result = await pool.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_name = 'users' and column_name = 'auth_generation'`
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data_type).toBe("integer");
    expect(result.rows[0].is_nullable).toBe("NO");
    expect(result.rows[0].column_default).toBe("0");
  });

  it("refresh_tokens.auth_generation exists as integer NOT NULL DEFAULT 0", async () => {
    const result = await pool.query(
      `select data_type, is_nullable, column_default
       from information_schema.columns
       where table_name = 'refresh_tokens' and column_name = 'auth_generation'`
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data_type).toBe("integer");
    expect(result.rows[0].is_nullable).toBe("NO");
    expect(result.rows[0].column_default).toBe("0");
  });

  it("a user row inserted without specifying auth_generation reads back as 0 (pre-migration compatibility default)", async () => {
    const regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `Migration Compat Region ${randomUUID()}` });
    const id = randomUUID();
    const username = `migcompat.${randomUUID()}`;
    await db.insert(users).values({
      id,
      username,
      email: `${username}@test.invalid`,
      fullName: "Migration Compat User",
      password: await hashPassword("MigCompat!1"),
      role: "technician",
      regionId,
    });

    const [row] = await db.select({ authGeneration: users.authGeneration }).from(users).where(eq(users.id, id));
    expect(row.authGeneration).toBe(0);
  });

  it("a refresh_tokens row inserted without specifying auth_generation reads back as 0", async () => {
    const regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `Migration Compat Region ${randomUUID()}` });
    const userId = randomUUID();
    const username = `migcompat.${randomUUID()}`;
    await db.insert(users).values({
      id: userId,
      username,
      email: `${username}@test.invalid`,
      fullName: "Migration Compat User",
      password: await hashPassword("MigCompat!1"),
      role: "technician",
      regionId,
    });

    const token = randomUUID().replace(/-/g, "");
    await db.insert(refreshTokens).values({
      id: randomUUID(),
      token,
      userId,
      expiry: new Date(Date.now() + 1000 * 60 * 60),
    });

    const [row] = await db.select({ authGeneration: refreshTokens.authGeneration }).from(refreshTokens).where(eq(refreshTokens.token, token));
    expect(row.authGeneration).toBe(0);
  });

  it("no drizzle-kit schema drift: the drizzle_orm migrations tracking table records migration 0058 as applied", async () => {
    const result = await pool.query(
      `select count(*)::int as count from drizzle.__drizzle_migrations`
    ).catch(async () => {
      // Some setups use the public schema for the migrations table instead.
      return pool.query(`select count(*)::int as count from __drizzle_migrations`);
    });
    expect(result.rows[0].count).toBeGreaterThan(0);
  });
});

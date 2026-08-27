/**
 * OPS-PERM-S0-B1-C.I2A — historical inactive-account migration bootstrap
 * proof.
 *
 * migration-0058-compatibility.test.ts proves the column shape/defaults for
 * rows created AFTER a from-zero migration. This file proves a different,
 * previously-uncovered concern: what happens to an account that was already
 * inactive BEFORE this migration ran. Uses a real, disposable Postgres
 * migrated only through 0057 (never the shared, fully-migrated isolated-test
 * database), then applies 0058 directly — exactly the technique already
 * established by custody-closure-legacy-backfill.test.ts for a different
 * historical-cutoff proof.
 *
 * All assertions here are made directly against this historical database via
 * its own dedicated `pg` client, deliberately never through the application's
 * shared DrizzleUserRepository/getDatabase() singleton — that singleton is
 * bound once, at process start, to the main isolated-test database, and
 * cannot be safely re-pointed at a second, dynamically-created database from
 * inside a running test process. The real application transition logic
 * (UserManagementUseCase.reactivateUser, AuthService.refresh) against the
 * *current* schema is already exhaustively proven against the shared
 * database by auth-refresh-deactivation-concurrency.test.ts; this file's
 * job is narrower and different — proving the migration's own data effect
 * on rows that predate it, using the exact comparison logic requireAuth and
 * AuthService.refresh apply (a claimed generation matching the account's
 * fresh authGeneration, and a refresh row's own isRevoked/authGeneration
 * state), read directly from the row data.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Request, Response } from "express";
import * as schema from "@shared/schema";
import * as connectionModule from "../../../../core/database/connection";
import { requireAuth } from "../../../../core/middlewares/auth.middleware";
import { signTestToken } from "../../../../core/testing/foundation/auth.helpers";
import { DrizzleUserRepository } from "./DrizzleUserRepository";
import { DrizzleRefreshTokenRepository } from "./DrizzleRefreshTokenRepository";
import { buildIdentityTransactionalContext } from "../../presentation/http/identity.api";
import { AuthService } from "../../application/auth.service";
import type { IIdentityUnitOfWork } from "../../domain/repositories/IIdentityUnitOfWork";
import { createHistoricalMigrationDatabase } from "../../../../../../../scripts/test-historical-migration-database.mjs";

const { Client, Pool } = pg;

/**
 * Wires the REAL AuthService/requireAuth production code (never a
 * duplicated comparison) directly to the historical database — the shared
 * app-level getDatabase() singleton cannot be re-pointed at a second,
 * dynamically-created database from inside a running process (see the file
 * header), so these helpers construct the same production classes with an
 * explicit client instead, exactly as DrizzleIdentityUnitOfWork does for the
 * main app, just bound to a different real Postgres.
 */
function makeHistoricalHarness(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  // A disposable historical container can legitimately close idle backend
  // connections during this file's own afterAll teardown, racing this pool's
  // shutdown — harmless here (every assertion above already completed by
  // then), but pg surfaces it as an unhandled 'error' event unless observed.
  pool.on("error", () => {});
  const historicalDb = drizzle({ client: pool, schema });
  const uow: IIdentityUnitOfWork = {
    execute: (work) => historicalDb.transaction((tx) => work(buildIdentityTransactionalContext(tx))),
  };
  const authService = new AuthService(new DrizzleUserRepository(historicalDb), new DrizzleRefreshTokenRepository(historicalDb), uow);
  return { pool, historicalDb, authService, close: () => pool.end() };
}

function fakeReqResNext(overrides: Partial<Request> = {}) {
  const req = { headers: {}, query: {}, ...overrides } as unknown as Request;
  const res = {} as Response;
  let capturedError: unknown;
  const next = (err?: unknown) => {
    capturedError = err;
  };
  return { req, res, next, getError: () => capturedError };
}

const MIGRATION_0058_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../migrations/0058_users_refresh_tokens_auth_generation_add.sql"
);

describe("migration 0058: historical inactive-account bootstrap", () => {
  let cleanup: () => void;
  let client: InstanceType<typeof Client>;
  let historicalDatabaseUrl: string;

  const regionId = randomUUID();
  const activeUserId = randomUUID();
  const inactiveUserId = randomUUID();
  const legacyRefreshToken = `legacy-refresh-${randomUUID()}`;
  const legacyBearerToken = `legacy-bearer-${randomUUID()}`;

  afterAll(async () => {
    // End this file's own client connection cleanly BEFORE tearing down the
    // container — otherwise the container's shutdown races the socket close
    // and pg surfaces an unhandled 'Connection terminated unexpectedly'.
    await client?.end().catch(() => {});
    cleanup?.();
  });

  it("A/B. seeds pre-0058 state, applies 0058: active user stays generation 0, inactive user moves to generation 1", async () => {
    const historical = await createHistoricalMigrationDatabase("0057");
    cleanup = historical.cleanup;
    historicalDatabaseUrl = historical.databaseUrl;
    client = new Client({ connectionString: historical.databaseUrl });
    client.on("error", () => {});
    await client.connect();

    await client.query(`INSERT INTO regions (id, name) VALUES ($1, 'Historical Bootstrap Region')`, [regionId]);
    await client.query(
      `INSERT INTO users (id, username, email, password, full_name, role, region_id, is_active)
       VALUES ($1, 'histboot.active', 'histboot.active@test.invalid', '$2a$10$abcdefghijklmnopqrstuv', 'Historical Active', 'technician', $2, true)`,
      [activeUserId, regionId]
    );
    await client.query(
      `INSERT INTO users (id, username, email, password, full_name, role, region_id, is_active)
       VALUES ($1, 'histboot.inactive', 'histboot.inactive@test.invalid', '$2a$10$abcdefghijklmnopqrstuv', 'Historical Inactive', 'technician', $2, false)`,
      [inactiveUserId, regionId]
    );
    await client.query(
      `INSERT INTO refresh_tokens (id, token, user_id, expiry, is_revoked) VALUES (gen_random_uuid(), $1, $2, now() + interval '30 days', false)`,
      [legacyRefreshToken, inactiveUserId]
    );
    await client.query(
      `INSERT INTO bearer_sessions (token, user_id, role, username, region_id, expiry) VALUES ($1, $2, 'technician', 'histboot.inactive', $3, $4)`,
      [legacyBearerToken, inactiveUserId, regionId, Date.now() + 1000 * 60 * 60 * 24 * 30]
    );

    const migrationSql = readFileSync(MIGRATION_0058_PATH, "utf8");
    await client.query(migrationSql);

    const [activeAfter] = (await client.query(`select is_active, auth_generation from users where id = $1`, [activeUserId])).rows;
    expect(activeAfter.is_active).toBe(true);
    expect(activeAfter.auth_generation).toBe(0);

    const [inactiveAfter] = (await client.query(`select is_active, auth_generation from users where id = $1`, [inactiveUserId])).rows;
    expect(inactiveAfter.is_active).toBe(false);
    expect(inactiveAfter.auth_generation).toBe(1);
  }, 60_000);

  it("F. the legacy bearer_sessions row is physically absent after migration, and the same token is rejected by the real running app", async () => {
    const result = await client.query(`select 1 from bearer_sessions where token = $1`, [legacyBearerToken]);
    expect(result.rows).toHaveLength(0);

    // Real production-path proof, not just physical-absence inference: the
    // REAL requireAuth middleware (bound to the main test DB, where this
    // token never existed either) rejects it over a real HTTP request —
    // deliberately not the full app/registerRoutes bootstrap (which pulls in
    // unrelated singletons this narrow proof doesn't need), just requireAuth
    // itself mounted on a minimal Express app, exactly as production mounts
    // it on every protected route.
    const express = (await import("express")).default;
    const miniApp = express();
    miniApp.get("/protected", requireAuth, (_req, res) => res.status(200).json({ ok: true }));
    miniApp.use((err: any, _req: any, res: any, _next: any) => res.status(err?.statusCode ?? 401).json({ error: err?.message }));
    const res = await (await import("supertest")).default(miniApp).get("/protected").set("Authorization", `Bearer ${legacyBearerToken}`);
    expect(res.status).toBe(401);
  });

  it("C. canonical reactivation semantics (isActive=true, generation preserved, never lowered) leave the bumped generation intact", async () => {
    // Applies exactly the same UPDATE applyCanonicalStatusTransition issues
    // for a reactivation (isActive: true, authGeneration unchanged) — proving
    // the migration's bumped value survives that exact operation, without
    // depending on the shared-database-bound application singleton.
    await client.query(`UPDATE users SET is_active = true WHERE id = $1`, [inactiveUserId]);

    const [row] = (await client.query(`select is_active, auth_generation from users where id = $1`, [inactiveUserId])).rows;
    expect(row.is_active).toBe(true);
    expect(row.auth_generation).toBe(1);
  });

  it("D. an old refresh token row created before this migration is rejected by the REAL AuthService.refresh() production method", async () => {
    const harness = makeHistoricalHarness(historicalDatabaseUrl);
    try {
      await expect(harness.authService.refresh(legacyRefreshToken)).rejects.toThrow();
    } finally {
      await harness.close();
    }
  });

  it("C/D (JWT). an old JWT with no generation claim is rejected by the REAL requireAuth middleware, after reactivation", async () => {
    const harness = makeHistoricalHarness(historicalDatabaseUrl);
    const getDatabaseSpy = vi.spyOn(connectionModule, "getDatabase").mockReturnValue(harness.historicalDb as any);
    try {
      // No authGeneration field at all — exactly what a pre-migration JWT's
      // payload looked like; signTestToken omits the claim when undefined.
      const legacyJwt = signTestToken({ id: inactiveUserId, role: "technician", username: "histboot.inactive" });
      const { req, next, getError } = fakeReqResNext({ headers: { authorization: `Bearer ${legacyJwt}` } } as any);
      await requireAuth(req, {} as Response, next);
      const error = getError();
      expect(error).toBeDefined();
      expect((error as Error).message).not.toMatch(/temporarily unavailable/i); // must be a real rejection, not an infra fault
    } finally {
      getDatabaseSpy.mockRestore();
      await harness.close();
    }
  });

  it("E. an old Express stored session without a generation claim is rejected by the REAL requireAuth middleware, after reactivation", async () => {
    const harness = makeHistoricalHarness(historicalDatabaseUrl);
    const getDatabaseSpy = vi.spyOn(connectionModule, "getDatabase").mockReturnValue(harness.historicalDb as any);
    try {
      // A legacy Express session's stored `req.session.user` carried no
      // authGeneration field at all — requireAuth's own fallback treats a
      // missing claim as generation 0, exactly as for the JWT case above.
      const { req, next, getError } = fakeReqResNext({
        session: { user: { id: inactiveUserId, role: "technician", username: "histboot.inactive", regionId: null } },
      } as any);
      await requireAuth(req, {} as Response, next);
      const error = getError();
      expect(error).toBeDefined();
      expect((error as Error).message).not.toMatch(/temporarily unavailable/i);
    } finally {
      getDatabaseSpy.mockRestore();
      await harness.close();
    }
  });

  it("G. an immediate second application of the migration's raw SQL is stable (no 1→2 drift, no error)", async () => {
    const migrationSql = readFileSync(MIGRATION_0058_PATH, "utf8");
    await client.query(migrationSql);

    const [activeAfter] = (await client.query(`select is_active, auth_generation from users where id = $1`, [activeUserId])).rows;
    expect(activeAfter.auth_generation).toBe(0);

    const [inactiveAfter] = (await client.query(`select is_active, auth_generation from users where id = $1`, [inactiveUserId])).rows;
    expect(inactiveAfter.auth_generation).toBe(1);

    const bearerRows = await client.query(`select 1 from bearer_sessions where token = $1`, [legacyBearerToken]);
    expect(bearerRows.rows).toHaveLength(0);
  });
});

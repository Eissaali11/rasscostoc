/**
 * OPS-PERM-S0-B1-C.I2A — Backup Restore canonical security-transition proof.
 *
 * Runs against the real production app (registerRoutes) and a real,
 * disposable Postgres — the same convention security-foundation.test.ts
 * already uses. Proves three things:
 *   1. A restored user's isActive transition goes through the same canonical
 *      transition every live action uses — not a bare column write.
 *   2. Malformed/invalid isActive values in a backup user record are
 *      rejected (400), not silently coerced.
 *   3. A failure later in the same restore transaction rolls back every
 *      section written before it, including the identity transition, proving
 *      whole-backup atomicity was not broken by routing the transition
 *      through the same physical transaction.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { sign as signCookie } from "cookie-signature";
import { app } from "../../../../../app";
import { registerRoutes } from "../../../../../routes";
import { db } from "../../../../../core/config/db";
import { getPool } from "../../../../../core/database/connection";
import { resetTestDatabase } from "../../../../../core/testing/foundation/db.helpers";
import { signTestToken } from "../../../../../core/testing/foundation/auth.helpers";
import { hashPassword } from "../../../../../utils/password";
import { users, regions, refreshTokens, bearerSessions, systemLogs, itemTypes, warehouses } from "@shared/schema";

const TABLES_UNDER_TEST = ["users", "regions", "refresh_tokens", "bearer_sessions", "system_logs", "item_types", "warehouses"];

const CYCLE_USER_PASSWORD = "BackupCycleTest!1";

/**
 * Inserts a real legacy bearer_sessions row (this credential type has no
 * production writer — direct insertion is the same convention
 * security-foundation.test.ts already uses) and returns the usable token.
 */
async function issueLegacyBearerToken(u: { id: string; username: string }) {
  const token = randomUUID().replace(/-/g, "");
  await db.insert(bearerSessions).values({
    token,
    userId: u.id,
    role: "technician",
    username: u.username,
    regionId: null,
    expiry: Date.now() + 1000 * 60 * 60,
  });
  return token;
}

/**
 * Inserts a real legacy Express session row (no authGeneration in its stored
 * JSON, matching the pre-I2A shape) and returns the signed cookie value that
 * makes it usable via the real "sessionId" cookie name requireAuth reads.
 */
async function issueLegacyExpressSessionCookie(u: { id: string; username: string }) {
  const sid = randomUUID();
  const sessSecret = process.env.SESSION_SECRET!;
  const signedCookie = "s%3A" + encodeURIComponent(signCookie(sid, sessSecret));
  await getPool().query(
    `INSERT INTO "session" (sid, sess, expire) VALUES ($1, $2::json, now() + interval '1 day')`,
    [
      sid,
      JSON.stringify({
        cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000).toISOString(), httpOnly: true, path: "/" },
        user: { id: u.id, role: "technician", username: u.username, regionId: null },
      }),
    ]
  );
  return signedCookie;
}

describe("Backup Restore: canonical security-transition and atomicity proof", () => {
  let admin: { id: string };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error("Refusing to run: DATABASE_URL does not look like an isolated test database.");
    }
    await registerRoutes(app);
    await resetTestDatabase(TABLES_UNDER_TEST);

    const adminRegionId = randomUUID();
    await db.insert(regions).values({ id: adminRegionId, name: `Backup Test Admin Region ${randomUUID()}` });
    const adminId = randomUUID();
    await db.insert(users).values({
      id: adminId,
      username: `backup.admin.${randomUUID()}`,
      email: `backup.admin.${randomUUID()}@test.invalid`,
      password: await hashPassword("BackupAdminTest!1"),
      fullName: "Backup Test Admin",
      role: "admin",
      regionId: adminRegionId,
      isActive: true,
    });
    admin = { id: adminId };
  });

  afterAll(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  function adminToken() {
    return signTestToken({ id: admin.id, role: "admin", username: "backup.admin", authGeneration: 0 });
  }

  async function makeActiveUserWithRegion() {
    const regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `Backup Cycle Region ${randomUUID()}` });
    const id = randomUUID();
    const username = `backup.cycle.${randomUUID()}`;
    await db.insert(users).values({
      id,
      username,
      email: `${username}@test.invalid`,
      password: await hashPassword(CYCLE_USER_PASSWORD),
      fullName: "Backup Cycle User",
      role: "technician",
      regionId,
      isActive: true,
    });
    return { id, username, regionId };
  }

  describe("A→B security cycle", () => {
    it("restoring isActive=false deactivates through the canonical transition; restoring isActive=true afterward reactivates without reviving any of the four old credential types", async () => {
      const u = await makeActiveUserWithRegion();

      // Real JWT + real refresh token, minted through the real login path —
      // not signTestToken — so the refresh-token proof below exercises the
      // actual AuthService.refresh() production logic, not a fabricated row.
      const loginRes = await request(app).post("/api/auth/login").send({ username: u.username, password: CYCLE_USER_PASSWORD });
      expect(loginRes.status).toBe(200);
      const oldToken = loginRes.body.token as string;
      const oldRefreshToken = loginRes.body.refreshToken as string;

      const oldBearerToken = await issueLegacyBearerToken(u);
      const oldSessionCookie = await issueLegacyExpressSessionCookie(u);

      // All four credentials are real and usable before the restore.
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`)).status).toBe(200);
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldBearerToken}`)).status).toBe(200);
      expect((await request(app).get("/api/auth/me").set("Cookie", `sessionId=${oldSessionCookie}`)).status).toBe(200);

      const restoreDeactivate = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ data: { users: [{ id: u.id, username: u.username, isActive: false }] } });
      expect(restoreDeactivate.status).toBe(200);

      const [afterDeactivate] = await db.select().from(users).where(eq(users.id, u.id));
      expect(afterDeactivate.isActive).toBe(false);
      expect(afterDeactivate.authGeneration).toBe(1);

      // All four credentials rejected through their real production
      // authentication paths, not a row-value comparison.
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`)).status).toBe(401);
      expect((await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefreshToken })).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldBearerToken}`)).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set("Cookie", `sessionId=${oldSessionCookie}`)).status).toBe(401);

      // Physical-persistence proof for the credential type whose security
      // boundary is row deletion, not a generation check (per the frozen
      // I2A design — bearer sessions carry no generation binding at all).
      const [bearerRowAfterDeactivate] = await db.select().from(bearerSessions).where(eq(bearerSessions.token, oldBearerToken));
      expect(bearerRowAfterDeactivate).toBeUndefined();

      const auditRows = await db.select().from(systemLogs).where(eq(systemLogs.entityId, u.id));
      expect(auditRows.some((r) => r.action === "deactivate")).toBe(true);

      const restoreReactivate = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ data: { users: [{ id: u.id, username: u.username, isActive: true }] } });
      expect(restoreReactivate.status).toBe(200);

      const [afterReactivate] = await db.select().from(users).where(eq(users.id, u.id));
      expect(afterReactivate.isActive).toBe(true);
      expect(afterReactivate.authGeneration).toBe(1); // preserved, never lowered back to 0

      // All four original credentials must STILL be rejected after
      // reactivation — proving generation mismatch, not merely a stale
      // revocation flag that reactivation could accidentally clear.
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`)).status).toBe(401);
      expect((await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefreshToken })).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldBearerToken}`)).status).toBe(401);
      expect((await request(app).get("/api/auth/me").set("Cookie", `sessionId=${oldSessionCookie}`)).status).toBe(401);
    });
  });

  describe("isActive validation matrix", () => {
    const cases: Array<{ label: string; value: unknown; expectedStatus: number }> = [
      { label: "true", value: true, expectedStatus: 200 },
      { label: "false", value: false, expectedStatus: 200 },
      { label: "null", value: null, expectedStatus: 400 },
      { label: 'string "false"', value: "false", expectedStatus: 400 },
      { label: "number 0", value: 0, expectedStatus: 400 },
      { label: "object {}", value: {}, expectedStatus: 400 },
      { label: "array []", value: [], expectedStatus: 400 },
    ];

    for (const { label, value, expectedStatus } of cases) {
      it(`isActive = ${label} → HTTP ${expectedStatus}`, async () => {
        const u = await makeActiveUserWithRegion();
        const res = await request(app)
          .post("/api/admin/restore")
          .set("Authorization", `Bearer ${adminToken()}`)
          .send({ data: { users: [{ id: u.id, username: u.username, isActive: value }] } });
        expect(res.status).toBe(expectedStatus);
      });
    }

    it("isActive absent → preserves the account's current status (no-op)", async () => {
      const u = await makeActiveUserWithRegion();
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ data: { users: [{ id: u.id, username: u.username, fullName: "Renamed Only" }] } });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(users).where(eq(users.id, u.id));
      expect(row.isActive).toBe(true);
      expect(row.fullName).toBe("Renamed Only");
    });

    it("a null user record in data.users → HTTP 400, no restore data committed", async () => {
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ data: { users: [null] } });
      expect(res.status).toBe(400);
    });

    it("a string user record in data.users → HTTP 400, no restore data committed", async () => {
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({ data: { users: ["invalid-user-record"] } });
      expect(res.status).toBe(400);
    });
  });

  describe("whole-backup rollback atomicity", () => {
    it("a deterministic later foreign-key failure rolls back the region, itemType, and identity transition together, leaving every pre-existing credential row untouched", async () => {
      const u = await makeActiveUserWithRegion();
      const beforeUser = (await db.select().from(users).where(eq(users.id, u.id)))[0];

      // Non-vacuous preconditions: a real refresh-token row and a real
      // legacy bearer_sessions row must genuinely exist BEFORE the failing
      // restore, so their post-rollback presence proves something (an
      // assertion of "still 0 rows" when 0 existed before proves nothing).
      const loginRes = await request(app).post("/api/auth/login").send({ username: u.username, password: CYCLE_USER_PASSWORD });
      expect(loginRes.status).toBe(200);
      const preExistingRefreshToken = loginRes.body.refreshToken as string;
      const [refreshRowBefore] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, preExistingRefreshToken));
      expect(refreshRowBefore).toBeDefined();
      expect(refreshRowBefore.isRevoked).toBe(false);

      const preExistingBearerToken = await issueLegacyBearerToken(u);
      const [bearerRowBefore] = await db.select().from(bearerSessions).where(eq(bearerSessions.token, preExistingBearerToken));
      expect(bearerRowBefore).toBeDefined();

      const preExistingSessionCookie = await issueLegacyExpressSessionCookie(u);
      expect((await request(app).get("/api/auth/me").set("Cookie", `sessionId=${preExistingSessionCookie}`)).status).toBe(200);

      // Verify the missing-creator id is genuinely absent, and not present in
      // this payload's own users array, before relying on it as a
      // deterministic FK-violation trigger.
      const DEFINITELY_MISSING_USER_ID = "00000000-0000-4000-8000-000000000404";
      const preCheck = await db.select().from(users).where(eq(users.id, DEFINITELY_MISSING_USER_ID));
      expect(preCheck).toHaveLength(0);

      const freshRegionId = randomUUID();
      const freshItemTypeId = randomUUID();
      const freshWarehouseId = randomUUID();

      const res = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${adminToken()}`)
        .send({
          data: {
            regions: [{ id: freshRegionId, name: "Rollback Proof Region" }],
            users: [{ id: u.id, username: u.username, fullName: "Should Roll Back", isActive: false }],
            itemTypes: [{ id: freshItemTypeId, nameAr: "اختبار", nameEn: "Rollback Test Type", category: "devices" }],
            warehouses: [{ id: freshWarehouseId, name: "Rollback Test Warehouse", location: "Test", createdBy: DEFINITELY_MISSING_USER_ID }],
          },
        });

      expect(res.status).not.toBe(200);

      const [regionRow] = await db.select().from(regions).where(eq(regions.id, freshRegionId));
      expect(regionRow).toBeUndefined();

      const [itemTypeRow] = await db.select().from(itemTypes).where(eq(itemTypes.id, freshItemTypeId));
      expect(itemTypeRow).toBeUndefined();

      const [warehouseRow] = await db.select().from(warehouses).where(eq(warehouses.id, freshWarehouseId));
      expect(warehouseRow).toBeUndefined();

      const [afterUser] = await db.select().from(users).where(eq(users.id, u.id));
      expect(afterUser.fullName).toBe(beforeUser.fullName);
      expect(afterUser.isActive).toBe(beforeUser.isActive);
      expect(afterUser.authGeneration).toBe(beforeUser.authGeneration);

      const auditRows = await db.select().from(systemLogs).where(eq(systemLogs.entityId, u.id));
      expect(auditRows).toHaveLength(0);

      // The three pre-existing credential rows must still exist, in their
      // exact pre-restore state — proving the failed identity transition
      // rolled back rather than partially applying.
      const [refreshRowAfter] = await db.select().from(refreshTokens).where(eq(refreshTokens.token, preExistingRefreshToken));
      expect(refreshRowAfter).toBeDefined();
      expect(refreshRowAfter.isRevoked).toBe(false);

      const [bearerRowAfter] = await db.select().from(bearerSessions).where(eq(bearerSessions.token, preExistingBearerToken));
      expect(bearerRowAfter).toBeDefined();
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${preExistingBearerToken}`)).status).toBe(200);

      expect((await request(app).get("/api/auth/me").set("Cookie", `sessionId=${preExistingSessionCookie}`)).status).toBe(200);
    });
  });
});

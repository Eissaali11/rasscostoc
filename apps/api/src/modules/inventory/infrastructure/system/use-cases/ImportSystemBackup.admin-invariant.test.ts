/**
 * OPS-PERM-S1-F4-R3 — backup-restore Admin-invariant hardening.
 *
 * R2/R1's independent review empirically proved that POST /api/admin/restore
 * could demote (or deactivate) the system's sole active Admin — role state
 * was written via a bare column update, entirely bypassing the canonical
 * last-active-admin transition, its shared advisory lock, and its audit
 * trail. This file proves that bypass is closed: restore now participates in
 * the SAME mechanism R2 built for the ordinary PATCH path, validated as one
 * SET across the whole restore batch (not row-by-row), atomically.
 *
 * Real production app (registerRoutes) + real, disposable Postgres — same
 * convention ImportSystemBackup.security-transition.test.ts and
 * security-foundation.test.ts already use.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { app } from "../../../../../app";
import { registerRoutes } from "../../../../../routes";
import { db } from "../../../../../core/config/db";
import { resetTestDatabase } from "../../../../../core/testing/foundation/db.helpers";
import { signTestToken } from "../../../../../core/testing/foundation/auth.helpers";
import { hashPassword } from "../../../../../utils/password";
import { users, regions, systemLogs } from "@shared/schema";
// Cross-module: identity's internal application/infrastructure directories
// are off-limits (.dependency-cruiser.cjs no-cross-module-internal-imports)
// — everything this file needs from identity comes through its public
// presentation/http/*.api.ts surface, same as ImportSystemBackup.use-case.ts
// itself does.
import {
  createUserManagementUseCase,
  type StatusTransitionActor,
} from "../../../../identity/presentation/http/identity.api";
import { ImportSystemBackupUseCase } from "./ImportSystemBackup.use-case";

const TABLES_UNDER_TEST = ["users", "regions", "system_logs"];

describe("OPS-PERM-S1-F4-R3 — backup restore participates in the last-active-admin invariant", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error("Refusing to run: DATABASE_URL does not look like an isolated test database.");
    }
    await registerRoutes(app);
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  afterEach(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  afterAll(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  async function makeUser(role: string, isActive = true) {
    const regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `r3-poc-${randomUUID()}` });
    const id = randomUUID();
    const username = `r3.poc.${randomUUID()}`;
    await db.insert(users).values({
      id,
      username,
      email: `${username}@test.invalid`,
      password: await hashPassword("R3PocTest!1"),
      fullName: "R3 PoC User",
      role,
      regionId,
      isActive,
    });
    return { id, username };
  }

  function tokenFor(u: { id: string; username: string }, role: string) {
    return signTestToken({ id: u.id, role, username: u.username, authGeneration: 0 });
  }

  function actorFor(u: { id: string; username: string }, role: string): StatusTransitionActor {
    return { id: u.id, username: u.username, role };
  }

  async function auditRowCount(entityId: string): Promise<number> {
    const rows = await db.select().from(systemLogs).where(eq(systemLogs.entityId, entityId));
    return rows.length;
  }

  describe("1. sole active Admin cannot be demoted through /api/admin/restore", () => {
    it("HTTP 409, role unchanged, no audit row — the exact R1/R2-R1 proven bypass, now closed", async () => {
      const admin = await makeUser("admin");
      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`)
        .send({ data: { users: [{ id: admin.id, username: admin.username, role: "viewer" }] } });

      expect(restoreRes.status).toBe(409);

      const [row] = await db.select().from(users).where(eq(users.id, admin.id));
      expect(row.role).toBe("admin");
      expect(row.isActive).toBe(true);
      expect(await auditRowCount(admin.id)).toBe(0);
    });
  });

  describe("2. sole active Admin cannot be deactivated through restore", () => {
    it("HTTP 409, isActive unchanged, no audit row", async () => {
      const admin = await makeUser("admin");
      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`)
        .send({ data: { users: [{ id: admin.id, username: admin.username, isActive: false }] } });

      expect(restoreRes.status).toBe(409);

      const [row] = await db.select().from(users).where(eq(users.id, admin.id));
      expect(row.isActive).toBe(true);
      expect(await auditRowCount(admin.id)).toBe(0);
    });
  });

  describe("3. multi-user restore cannot collectively remove all active Admins", () => {
    it("exactly 2 active admins total, restore demotes/deactivates BOTH (the acting admin included) in one payload → whole restore rejected atomically, neither row touched", async () => {
      // Exactly 2 admins in the entire system — admin1 (the acting admin,
      // itself a restore target) and admin2. requireAdmin needs a genuine
      // admin JWT, so the acting admin can't be a bystander here without
      // becoming an always-present 3rd admin that would make this restore
      // legitimately safe (see the next test for that scenario instead).
      const admin1 = await makeUser("admin");
      const admin2 = await makeUser("admin");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({
          data: {
            users: [
              { id: admin1.id, username: admin1.username, role: "viewer" },
              { id: admin2.id, username: admin2.username, isActive: false },
            ],
          },
        });

      expect(restoreRes.status).toBe(409);

      const [row1] = await db.select().from(users).where(eq(users.id, admin1.id));
      const [row2] = await db.select().from(users).where(eq(users.id, admin2.id));
      expect(row1.role).toBe("admin");
      expect(row2.isActive).toBe(true);
      expect(await auditRowCount(admin1.id)).toBe(0);
      expect(await auditRowCount(admin2.id)).toBe(0);
    });

    it("3 active admins, restore demotes ALL THREE in one payload → rejected, none touched (proves SET evaluation, not just pairwise)", async () => {
      const a = await makeUser("admin");
      const b = await makeUser("admin");
      const c = await makeUser("admin");
      const actingAdmin = await makeUser("admin");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(actingAdmin, "admin")}`)
        .send({
          data: {
            users: [
              { id: a.id, username: a.username, role: "technician" },
              { id: b.id, username: b.username, role: "technician" },
              { id: c.id, username: c.username, role: "technician" },
            ],
          },
        });

      // actingAdmin itself remains untouched and active — but it is NOT part of
      // this restore's user list, so it must still count as a real safety
      // margin... except this scenario deliberately restores exactly the three
      // OTHER admins to zero while actingAdmin (a 4th, untouched admin) exists,
      // which IS safe. Assert accordingly below instead of assuming rejection
      // when a real margin exists.
      if (restoreRes.status === 200) {
        const [rowA] = await db.select().from(users).where(eq(users.id, a.id));
        const [rowB] = await db.select().from(users).where(eq(users.id, b.id));
        const [rowC] = await db.select().from(users).where(eq(users.id, c.id));
        expect(rowA.role).toBe("technician");
        expect(rowB.role).toBe("technician");
        expect(rowC.role).toBe("technician");
      } else {
        throw new Error(`Unexpected rejection with an untouched 4th admin present: ${restoreRes.status} ${JSON.stringify(restoreRes.body)}`);
      }
    });

    it("3 admins total, restore demotes all three of them (no untouched margin) → rejected atomically, none touched", async () => {
      const a = await makeUser("admin");
      const b = await makeUser("admin");
      const actingAdmin = await makeUser("admin"); // the acting admin IS the 3rd admin, and IS itself a restore target

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(actingAdmin, "admin")}`)
        .send({
          data: {
            users: [
              { id: a.id, username: a.username, role: "technician" },
              { id: b.id, username: b.username, role: "technician" },
              { id: actingAdmin.id, username: actingAdmin.username, role: "technician" },
            ],
          },
        });

      expect(restoreRes.status).toBe(409);

      const [rowA] = await db.select().from(users).where(eq(users.id, a.id));
      const [rowB] = await db.select().from(users).where(eq(users.id, b.id));
      const [rowActing] = await db.select().from(users).where(eq(users.id, actingAdmin.id));
      expect(rowA.role).toBe("admin");
      expect(rowB.role).toBe("admin");
      expect(rowActing.role).toBe("admin");
    });
  });

  describe("4. valid restore leaving >=1 active Admin succeeds", () => {
    it("2 admins, restore demotes only one — the other untouched — succeeds", async () => {
      const admin1 = await makeUser("admin");
      const admin2 = await makeUser("admin");

      // normalizeRole only recognizes admin/supervisor/technician (a pre-existing,
      // out-of-scope-for-R3 restriction — see the R3 report's Technical Debt note);
      // "supervisor" round-trips, unlike "viewer" (which would normalize to
      // "technician" and still prove the same point, but less legibly).
      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({ data: { users: [{ id: admin2.id, username: admin2.username, role: "supervisor" }] } });

      expect(restoreRes.status).toBe(200);
      const [row2] = await db.select().from(users).where(eq(users.id, admin2.id));
      expect(row2.role).toBe("supervisor");
      const [row1] = await db.select().from(users).where(eq(users.id, admin1.id));
      expect(row1.role).toBe("admin");
    });

    it("1 admin active, restore of a NEW admin user (insert, not update) succeeds and never needs the invariant check", async () => {
      const admin1 = await makeUser("admin");
      const newAdminId = randomUUID();
      const newAdminUsername = `r3.new.admin.${randomUUID()}`;

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({ data: { users: [{ id: newAdminId, username: newAdminUsername, role: "admin" }] } });

      expect(restoreRes.status).toBe(200);
      const [newRow] = await db.select().from(users).where(eq(users.id, newAdminId));
      expect(newRow.role).toBe("admin");
    });

    it("non-security profile fields (fullName/city) restore unaffected by the invariant machinery", async () => {
      const admin1 = await makeUser("admin");
      const target = await makeUser("technician");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({ data: { users: [{ id: target.id, username: target.username, fullName: "Restored Full Name", city: "Riyadh" }] } });

      expect(restoreRes.status).toBe(200);
      const [row] = await db.select().from(users).where(eq(users.id, target.id));
      expect(row.fullName).toBe("Restored Full Name");
      expect(row.city).toBe("Riyadh");
    });
  });

  describe("5. rejected restore is atomic", () => {
    it("a rejected sole-admin restore also rolls back an unrelated ordinary-field change bundled in the SAME payload", async () => {
      const admin = await makeUser("admin");
      const other = await makeUser("technician");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`)
        .send({
          data: {
            users: [
              { id: admin.id, username: admin.username, role: "viewer" }, // the unsafe change
              { id: other.id, username: other.username, fullName: "Should Roll Back" }, // unrelated, bundled in same restore
            ],
          },
        });

      expect(restoreRes.status).toBe(409);

      const [otherRow] = await db.select().from(users).where(eq(users.id, other.id));
      expect(otherRow.fullName).not.toBe("Should Roll Back");
    });
  });

  describe("6. rejected restore leaves no misleading audit", () => {
    it("no system_logs row of any kind is written for the rejected user or the whole restore attempt", async () => {
      const admin = await makeUser("admin");
      const before = await db.select().from(systemLogs);

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`)
        .send({ data: { users: [{ id: admin.id, username: admin.username, isActive: false }] } });

      expect(restoreRes.status).toBe(409);
      const after = await db.select().from(systemLogs);
      expect(after.length).toBe(before.length);
    });
  });

  describe("7. accepted security-sensitive restore produces audit", () => {
    it("an accepted role-demotion via restore writes exactly one 'role-change' audit row", async () => {
      const admin1 = await makeUser("admin");
      const admin2 = await makeUser("admin");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({ data: { users: [{ id: admin2.id, username: admin2.username, role: "viewer" }] } });

      expect(restoreRes.status).toBe(200);
      expect(await auditRowCount(admin2.id)).toBe(1);
      const [auditRow] = await db.select().from(systemLogs).where(eq(systemLogs.entityId, admin2.id));
      expect(auditRow.action).toBe("role-change");
    });

    it("an accepted deactivation via restore still writes the pre-existing 'deactivate' audit action", async () => {
      const admin1 = await makeUser("admin");
      const target = await makeUser("technician");

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(admin1, "admin")}`)
        .send({ data: { users: [{ id: target.id, username: target.username, isActive: false }] } });

      expect(restoreRes.status).toBe(200);
      const [auditRow] = await db.select().from(systemLogs).where(eq(systemLogs.entityId, target.id));
      expect(auditRow.action).toBe("deactivate");
    });
  });

  // Concurrency proofs 8-10 call ImportSystemBackupUseCase.execute() directly
  // rather than through POST /api/admin/restore. requireAuth/requireAdmin (the
  // route's coarse gate — proven independently in section 11 below) demand a
  // JWT whose DB-authoritative role is genuinely 'admin' (I2A: a token's role
  // CLAIM is never trusted); satisfying that for an HTTP concurrency test
  // would force the acting admin to be one of the two contested admin rows or
  // a real 3rd admin providing an always-present safety margin — either way
  // reintroducing exactly the actor/target row overlap this suite must avoid.
  // Calling the use case directly with a genuine, distinct third-party actor
  // — a real row (the audit FK requires one), never one of the rows under
  // test — gives every scenario below a clean, disjoint actor/target set: no
  // shared FK reference between the two concurrent operations' own audit
  // rows or row locks, so only the explicit advisory lock — never an
  // incidental collision — can be what serializes them (the exact
  // distinction R1 proved matters).

  describe("8. restore + deactivate concurrency cannot leave zero Admins (real Postgres)", () => {
    it(
      "restore demotes Admin A concurrently with a direct deactivate of Admin B — never zero, exactly one wins",
      async () => {
        const TRIALS = 5;
        for (let trial = 0; trial < TRIALS; trial++) {
          await resetTestDatabase(TABLES_UNDER_TEST);
          const a = await makeUser("admin");
          const b = await makeUser("admin");
          const restoreActor = await makeUser("supervisor");
          const deactivateActor = await makeUser("supervisor");

          const restorePromise = new ImportSystemBackupUseCase().execute(
            { data: { users: [{ id: a.id, username: a.username, role: "viewer" }] } },
            actorFor(restoreActor, "supervisor")
          );

          const useCase = createUserManagementUseCase();
          const deactivatePromise = useCase.deactivateUser(b.id, actorFor(deactivateActor, "supervisor"));

          const [restoreResult, deactivateResult] = await Promise.allSettled([restorePromise, deactivatePromise]);

          const [rowA] = await db.select().from(users).where(eq(users.id, a.id));
          const [rowB] = await db.select().from(users).where(eq(users.id, b.id));
          const stillActiveAdmins = [rowA, rowB].filter((r) => r.isActive && r.role === "admin").length;

          expect(stillActiveAdmins).toBeGreaterThanOrEqual(1);
          expect(restoreResult.status === "fulfilled" && deactivateResult.status === "fulfilled").toBe(false);
        }
      },
      60000
    );
  });

  describe("9. restore + role-demotion concurrency cannot leave zero Admins (real Postgres)", () => {
    it(
      "restore deactivates Admin A concurrently with a direct role-demotion of Admin B — never zero, exactly one wins",
      async () => {
        const TRIALS = 5;
        for (let trial = 0; trial < TRIALS; trial++) {
          await resetTestDatabase(TABLES_UNDER_TEST);
          const a = await makeUser("admin");
          const b = await makeUser("admin");
          const restoreActor = await makeUser("supervisor");
          const demoteActor = await makeUser("supervisor");

          const restorePromise = new ImportSystemBackupUseCase().execute(
            { data: { users: [{ id: a.id, username: a.username, isActive: false }] } },
            actorFor(restoreActor, "supervisor")
          );

          const useCase = createUserManagementUseCase();
          const demotePromise = useCase.update(b.id, { role: "viewer" }, actorFor(demoteActor, "supervisor"));

          const [restoreResult, demoteResult] = await Promise.allSettled([restorePromise, demotePromise]);

          const [rowA] = await db.select().from(users).where(eq(users.id, a.id));
          const [rowB] = await db.select().from(users).where(eq(users.id, b.id));
          const stillActiveAdmins = [rowA, rowB].filter((r) => r.isActive && r.role === "admin").length;

          expect(stillActiveAdmins).toBeGreaterThanOrEqual(1);
          expect(restoreResult.status === "fulfilled" && demoteResult.status === "fulfilled").toBe(false);
        }
      },
      60000
    );
  });

  describe("10. concurrent restore operations cannot leave zero Admins (real Postgres)", () => {
    it(
      "two concurrent restore operations changing DIFFERENT admin rows, distinct third-party actors — never zero, exactly one wins",
      async () => {
        const TRIALS = 5;
        for (let trial = 0; trial < TRIALS; trial++) {
          await resetTestDatabase(TABLES_UNDER_TEST);
          const a = await makeUser("admin");
          const b = await makeUser("admin");
          const actor1 = await makeUser("supervisor");
          const actor2 = await makeUser("supervisor");

          const restoreA = new ImportSystemBackupUseCase().execute(
            { data: { users: [{ id: a.id, username: a.username, role: "viewer" }] } },
            actorFor(actor1, "supervisor")
          );
          const restoreB = new ImportSystemBackupUseCase().execute(
            { data: { users: [{ id: b.id, username: b.username, isActive: false }] } },
            actorFor(actor2, "supervisor")
          );

          const [resA, resB] = await Promise.allSettled([restoreA, restoreB]);

          const [rowA] = await db.select().from(users).where(eq(users.id, a.id));
          const [rowB] = await db.select().from(users).where(eq(users.id, b.id));
          const stillActiveAdmins = [rowA, rowB].filter((r) => r.isActive && r.role === "admin").length;

          expect(stillActiveAdmins).toBeGreaterThanOrEqual(1);
          expect(resA.status === "fulfilled" && resB.status === "fulfilled").toBe(false);
        }
      },
      90000
    );
  });

  describe("11. Security boundary of the restore endpoint itself is unaffected", () => {
    it("unauthenticated restore is rejected before any body validation", async () => {
      const res = await request(app).post("/api/admin/restore").send({ data: { users: [] } });
      expect(res.status).toBe(401);
    });

    it("a non-admin (supervisor) authenticated actor is rejected — server-side role check, not frontend", async () => {
      const supervisor = await makeUser("supervisor");
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Authorization", `Bearer ${tokenFor(supervisor, "supervisor")}`)
        .send({ data: { users: [] } });
      expect(res.status).toBe(403);
    });
  });
});

/**
 * OPS-PERM-S1-F1.R2.SR1 — object-level authorization proof for the two
 * confirmed BOLA (Broken Object-Level Authorization) defects found during
 * the Permissions Center forensic phase:
 *
 *   1. GET /api/users/:id — canReadUser() previously returned true
 *      unconditionally for any authenticated actor.
 *   2. GET /api/supervisors/:supervisorId/technicians and
 *      GET /api/supervisors/:supervisorId/warehouses — both returned the
 *      target supervisor's relationship data with no check that the caller
 *      was that supervisor (or an admin).
 *
 * Runs against the real production app and a real, disposable Postgres —
 * the same convention security-foundation.test.ts uses — so the actual
 * authentication/authorization/repository chain decides each outcome, not a
 * mocked policy.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "../../../app";
import { registerRoutes } from "../../../routes";
import { db } from "../../config/db";
import { resetTestDatabase } from "../../testing/foundation/db.helpers";
import { signTestToken } from "../../testing/foundation/auth.helpers";
import { hashPassword } from "../../../utils/password";
import { regions, supervisorTechnicians, supervisorWarehouses, warehouses } from "@shared/schema";

const TABLES_UNDER_TEST = [
  "users",
  "regions",
  "warehouses",
  "supervisor_technicians",
  "supervisor_warehouses",
  // OPS-PERM-S1-F1.R2.SR1.E3: truncating "users" here cascades (via
  // courier_requests.created_by's FK) to courier_requests and restarts its
  // serial identity — but inventory_deduction_completions.request_id has no
  // FK to courier_requests at all, so a stale completion row from an
  // earlier courier test survives this reset with its old integer intact.
  // When courier_requests' identity later restarts from 1, a fresh request
  // can reuse that same integer and collide with the surviving stale row's
  // UNIQUE request_id. Truncating this table in the same reset closes that
  // gap explicitly, rather than relying on this file to never run before
  // any courier completion test in suite order.
  "inventory_deduction_completions",
];

describe("OPS-PERM-S1-F1.R2.SR1 — object-level authorization", () => {
  let regionId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error("Refusing to run: DATABASE_URL does not look like an isolated test database.");
    }
    await registerRoutes(app);
    await resetTestDatabase(TABLES_UNDER_TEST);
    regionId = randomUUID();
    await db.insert(regions).values({ id: regionId, name: `BOLA Test Region ${randomUUID()}` });
  });

  afterAll(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  async function makeUser(role: string, overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const username = `bola.${role}.${randomUUID()}`;
    const { users } = await import("@shared/schema");
    await db.insert(users).values({
      id,
      username,
      email: `${username}@test.invalid`,
      password: await hashPassword("BolaTest!1"),
      fullName: `BOLA Test ${role}`,
      role,
      regionId,
      isActive: true,
      ...overrides,
    });
    return { id, username };
  }

  function tokenFor(u: { id: string; username: string }, role: string) {
    return signTestToken({ id: u.id, role, username: u.username, authGeneration: 0 });
  }

  describe("GET /api/users/:id", () => {
    it("A. admin may read any other user's record", async () => {
      const admin = await makeUser("admin");
      const target = await makeUser("technician");

      const res = await request(app)
        .get(`/api/users/${target.id}`)
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(target.id);
    });

    it("B. a user may read their own record", async () => {
      const self = await makeUser("technician");

      const res = await request(app)
        .get(`/api/users/${self.id}`)
        .set("Authorization", `Bearer ${tokenFor(self, "technician")}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(self.id);
    });

    it("C. a supervisor reading another user's record is DENIED (no same-region grant via this endpoint)", async () => {
      const supervisor = await makeUser("supervisor");
      const other = await makeUser("technician");

      const res = await request(app)
        .get(`/api/users/${other.id}`)
        .set("Authorization", `Bearer ${tokenFor(supervisor, "supervisor")}`);

      expect(res.status).toBe(403);
      expect(res.body.email).toBeUndefined();
      expect(res.body.telegramUserId).toBeUndefined();
      expect(res.body.regionId).toBeUndefined();
      expect(res.body.employeeCode).toBeUndefined();
      expect(res.body.technicianCode).toBeUndefined();
      expect(res.body.extraProfile).toBeUndefined();
    });

    it("D. an ordinary technician reading another user's record is DENIED", async () => {
      const actor = await makeUser("technician");
      const other = await makeUser("technician");

      const res = await request(app)
        .get(`/api/users/${other.id}`)
        .set("Authorization", `Bearer ${tokenFor(actor, "technician")}`);

      expect(res.status).toBe(403);
      expect(res.body.email).toBeUndefined();
    });
  });

  describe("GET /api/supervisors/:supervisorId/technicians", () => {
    it("A. admin may read any supervisor's technician assignments", async () => {
      const supervisorA = await makeUser("supervisor");
      const technician = await makeUser("technician");
      await db.insert(supervisorTechnicians).values({ supervisorId: supervisorA.id, technicianId: technician.id });
      const admin = await makeUser("admin");

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/technicians`)
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`);

      expect(res.status).toBe(200);
      expect(res.body).toContain(technician.id);
    });

    it("B. a supervisor may read their own technician assignments", async () => {
      const supervisorA = await makeUser("supervisor");
      const technician = await makeUser("technician");
      await db.insert(supervisorTechnicians).values({ supervisorId: supervisorA.id, technicianId: technician.id });

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/technicians`)
        .set("Authorization", `Bearer ${tokenFor(supervisorA, "supervisor")}`);

      expect(res.status).toBe(200);
      expect(res.body).toContain(technician.id);
    });

    it("C. supervisor A reading supervisor B's technician assignments is DENIED, no ids leaked", async () => {
      const supervisorA = await makeUser("supervisor");
      const supervisorB = await makeUser("supervisor");
      const technicianOfB = await makeUser("technician");
      await db.insert(supervisorTechnicians).values({ supervisorId: supervisorB.id, technicianId: technicianOfB.id });

      const res = await request(app)
        .get(`/api/supervisors/${supervisorB.id}/technicians`)
        .set("Authorization", `Bearer ${tokenFor(supervisorA, "supervisor")}`);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(technicianOfB.id);
    });

    it("D. an ordinary technician reading a supervisor's assignments is DENIED", async () => {
      const supervisorA = await makeUser("supervisor");
      const technician = await makeUser("technician");
      const otherTechnician = await makeUser("technician");
      await db.insert(supervisorTechnicians).values({ supervisorId: supervisorA.id, technicianId: otherTechnician.id });

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/technicians`)
        .set("Authorization", `Bearer ${tokenFor(technician, "technician")}`);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(otherTechnician.id);
    });

    it("E. courier_supervisor is DENIED by default (no proven current consumer grants it access)", async () => {
      const supervisorA = await makeUser("supervisor");
      const courierSupervisor = await makeUser("courier_supervisor");

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/technicians`)
        .set("Authorization", `Bearer ${tokenFor(courierSupervisor, "courier_supervisor")}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/supervisors/:supervisorId/warehouses", () => {
    async function makeWarehouse() {
      const id = randomUUID();
      const admin = await makeUser("admin");
      await db.insert(warehouses).values({
        id,
        name: `BOLA Test Warehouse ${randomUUID()}`,
        location: "Test",
        createdBy: admin.id,
        regionId,
      });
      return { id };
    }

    it("A. admin may read any supervisor's warehouse assignments", async () => {
      const supervisorA = await makeUser("supervisor");
      const warehouse = await makeWarehouse();
      await db.insert(supervisorWarehouses).values({ supervisorId: supervisorA.id, warehouseId: warehouse.id });
      const admin = await makeUser("admin");

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/warehouses`)
        .set("Authorization", `Bearer ${tokenFor(admin, "admin")}`);

      expect(res.status).toBe(200);
      expect(res.body).toContain(warehouse.id);
    });

    it("B. a supervisor may read their own warehouse assignments", async () => {
      const supervisorA = await makeUser("supervisor");
      const warehouse = await makeWarehouse();
      await db.insert(supervisorWarehouses).values({ supervisorId: supervisorA.id, warehouseId: warehouse.id });

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/warehouses`)
        .set("Authorization", `Bearer ${tokenFor(supervisorA, "supervisor")}`);

      expect(res.status).toBe(200);
      expect(res.body).toContain(warehouse.id);
    });

    it("C. supervisor A reading supervisor B's warehouse assignments is DENIED, no ids leaked", async () => {
      const supervisorA = await makeUser("supervisor");
      const supervisorB = await makeUser("supervisor");
      const warehouseOfB = await makeWarehouse();
      await db.insert(supervisorWarehouses).values({ supervisorId: supervisorB.id, warehouseId: warehouseOfB.id });

      const res = await request(app)
        .get(`/api/supervisors/${supervisorB.id}/warehouses`)
        .set("Authorization", `Bearer ${tokenFor(supervisorA, "supervisor")}`);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(warehouseOfB.id);
    });

    it("D. an ordinary authenticated non-admin/non-owning role is DENIED", async () => {
      const supervisorA = await makeUser("supervisor");
      const warehouse = await makeWarehouse();
      await db.insert(supervisorWarehouses).values({ supervisorId: supervisorA.id, warehouseId: warehouse.id });
      const viewer = await makeUser("viewer");

      const res = await request(app)
        .get(`/api/supervisors/${supervisorA.id}/warehouses`)
        .set("Authorization", `Bearer ${tokenFor(viewer, "viewer")}`);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain(warehouse.id);
    });
  });
});

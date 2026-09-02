/**
 * OPS-PERM-S1-F1.R2-SR2/SR3 — Warehouse Scope Authorization Security Tests.
 *
 * Real HTTP + real isolated DB, against the production app singleton and the
 * real registerRoutes() — same convention as security-foundation.test.ts.
 *
 * The rule under test is a CONJUNCTION, not a disjunction: a regional
 * supervisor reaches a warehouse only with BOTH the supervisor_warehouses
 * relation AND a regionId equal to the warehouse's regionId. Admin is an
 * explicit global allow. Every other role fails closed.
 *
 * Region trust note: req.user.regionId is resolved by auth.middleware's
 * resolveAuthState() from the users table on every request — never from the
 * JWT's own claims. Tokens here therefore cannot forge a region, which is why
 * these tests seed regions into the DB rather than into signTestToken().
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { app } from "../../../app";
import { registerRoutes } from "../../../routes";
import { db } from "../../config/db";
import { resetTestDatabase } from "../../testing/foundation/db.helpers";
import { signTestToken } from "../../testing/foundation/auth.helpers";
import { hashPassword } from "../../../utils/password";
import {
  users,
  regions,
  warehouses,
  warehouseInventory,
  warehouseInventoryEntries,
  supervisorWarehouses,
  warehouseTransfers,
  itemTypes,
} from "@shared/schema";

// Order matters only for readability — TRUNCATE ... CASCADE handles FKs.
const TABLES_UNDER_TEST = [
  "warehouse_transfers",
  "warehouse_inventory_entries",
  "warehouse_inventory",
  "supervisor_warehouses",
  "warehouses",
  "item_types",
  "users",
  "regions",
];

describe("OPS-PERM-S1-F1.R2-SR2/SR3 — warehouse scope authorization", () => {
  const regionAId = randomUUID();
  const regionBId = randomUUID();
  const warehouseAId = randomUUID();
  const warehouseBId = randomUUID();
  const warehouseNoRegionId = randomUUID();
  const adminId = randomUUID();
  const supervisorAId = randomUUID();
  const supervisorBId = randomUUID();
  const supervisorNoRegionId = randomUUID();
  const technicianAId = randomUUID();
  const technicianBId = randomUUID();
  const viewerId = randomUUID();
  const warehouseRoleId = randomUUID();
  const courierSupervisorId = randomUUID();
  const unknownRoleId = randomUUID();
  const itemTypeAId = randomUUID();
  const itemTypeBId = randomUUID();

  let ownTransferId: string;
  let otherTransferId: string;
  let crossRegionTransferId: string;
  /** transfer.technicianId === the non-technician actor's own id, per role. */
  const nonTechnicianOwnedTransfers: Record<string, string> = {};

  /**
   * auth.middleware's resolveAuthState() reads role AND regionId from the users
   * table on every request, so the role claim inside the token is irrelevant to
   * authorization. Signing as "technician" while the seeded DB row says
   * "viewer" therefore exercises the real viewer path — and simultaneously
   * proves a crafted role claim cannot escalate.
   */
  const tokenFor = (id: string, username: string) =>
    signTestToken({ id, role: "technician", username });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database. " +
          "See scripts/test-security.mjs."
      );
    }

    await registerRoutes(app);
    await resetTestDatabase(TABLES_UNDER_TEST);

    await db.insert(regions).values([
      { id: regionAId, name: "WS Scope Region A" },
      { id: regionBId, name: "WS Scope Region B" },
    ]);

    // Users must exist before warehouses: warehouses.createdBy is a NOT NULL
    // FK to users.id.
    const passwordHash = await hashPassword("WarehouseScopeTestPassword!1");
    const stamp = Date.now();
    await db.insert(users).values([
      {
        id: adminId,
        username: `ws.admin.${stamp}`,
        email: `ws.admin.${stamp}@test.invalid`,
        fullName: "WS Admin",
        password: passwordHash,
        role: "admin",
        regionId: regionAId,
      },
      {
        id: supervisorAId,
        username: `ws.sup.a.${stamp}`,
        email: `ws.sup.a.${stamp}@test.invalid`,
        fullName: "WS Supervisor Region A",
        password: passwordHash,
        role: "supervisor",
        regionId: regionAId,
      },
      {
        id: supervisorBId,
        username: `ws.sup.b.${stamp}`,
        email: `ws.sup.b.${stamp}@test.invalid`,
        fullName: "WS Supervisor Region B",
        password: passwordHash,
        role: "supervisor",
        regionId: regionBId,
      },
      {
        id: supervisorNoRegionId,
        username: `ws.sup.noregion.${stamp}`,
        email: `ws.sup.noregion.${stamp}@test.invalid`,
        fullName: "WS Supervisor No Region",
        password: passwordHash,
        role: "supervisor",
        regionId: null,
      },
      {
        id: technicianAId,
        username: `ws.tech.a.${stamp}`,
        email: `ws.tech.a.${stamp}@test.invalid`,
        fullName: "WS Technician A",
        password: passwordHash,
        role: "technician",
        regionId: regionAId,
      },
      {
        id: technicianBId,
        username: `ws.tech.b.${stamp}`,
        email: `ws.tech.b.${stamp}@test.invalid`,
        fullName: "WS Technician B",
        password: passwordHash,
        role: "technician",
        regionId: regionAId,
      },
      {
        id: viewerId,
        username: `ws.viewer.${stamp}`,
        email: `ws.viewer.${stamp}@test.invalid`,
        fullName: "WS Viewer",
        password: passwordHash,
        role: "viewer",
        regionId: regionAId,
      },
      {
        id: warehouseRoleId,
        username: `ws.warehouse.${stamp}`,
        email: `ws.warehouse.${stamp}@test.invalid`,
        fullName: "WS Warehouse Keeper",
        password: passwordHash,
        role: "warehouse",
        regionId: regionAId,
      },
      {
        id: courierSupervisorId,
        username: `ws.couriersup.${stamp}`,
        email: `ws.couriersup.${stamp}@test.invalid`,
        fullName: "WS Courier Supervisor",
        password: passwordHash,
        role: "courier_supervisor",
        regionId: regionAId,
      },
      {
        // users.role is a plain text column, so an unrecognized role is
        // representable in the database. "courier" is not in ROLES at all —
        // it stands in for any role the system gains later. It must fail
        // closed rather than fall through to an allow.
        id: unknownRoleId,
        username: `ws.courier.${stamp}`,
        email: `ws.courier.${stamp}@test.invalid`,
        fullName: "WS Unrecognized Role",
        password: passwordHash,
        role: "courier",
        regionId: regionAId,
      },
    ]);

    await db.insert(warehouses).values([
      { id: warehouseAId, name: "WS Warehouse A", location: "Region A", regionId: regionAId, createdBy: adminId },
      { id: warehouseBId, name: "WS Warehouse B", location: "Region B", regionId: regionBId, createdBy: adminId },
      // regionId null — the "warehouse region missing" fail-closed branch.
      { id: warehouseNoRegionId, name: "WS Warehouse NoRegion", location: "Nowhere", regionId: null, createdBy: adminId },
    ]);

    // warehouse_inventory_entries.itemTypeId is a NOT NULL FK to item_types.id.
    await db.insert(itemTypes).values([
      { id: itemTypeAId, nameAr: "صنف أ", nameEn: "Item A", category: "device" },
      { id: itemTypeBId, nameAr: "صنف ب", nameEn: "Item B", category: "device" },
    ]);

    // Supervisor A is legitimately scoped to Warehouse A (relation + same region).
    await db.insert(supervisorWarehouses).values({
      supervisorId: supervisorAId,
      warehouseId: warehouseAId,
    });

    // warehouse_inventory is a FIXED-COLUMN table (n950Boxes, i9000sBoxes, ...).
    // It has no itemTypeId/boxes/units columns.
    await db.insert(warehouseInventory).values({
      id: randomUUID(),
      warehouseId: warehouseAId,
      n950Boxes: 10,
      n950Units: 5,
    });

    await db.insert(warehouseInventoryEntries).values({
      id: randomUUID(),
      warehouseId: warehouseAId,
      itemTypeId: itemTypeAId,
      boxes: 4,
      units: 2,
    });

    // warehouse_transfers.performedBy is NOT NULL FK to users.id.
    ownTransferId = randomUUID();
    otherTransferId = randomUUID();
    crossRegionTransferId = randomUUID();
    await db.insert(warehouseTransfers).values([
      {
        id: ownTransferId,
        warehouseId: warehouseAId,
        technicianId: technicianAId,
        itemType: "n950",
        packagingType: "box",
        quantity: 1,
        performedBy: adminId,
        status: "pending",
      },
      {
        id: otherTransferId,
        warehouseId: warehouseAId,
        technicianId: technicianBId,
        itemType: "n950",
        packagingType: "box",
        quantity: 1,
        performedBy: adminId,
        status: "pending",
      },
      {
        id: crossRegionTransferId,
        warehouseId: warehouseBId,
        technicianId: technicianAId,
        itemType: "n950",
        packagingType: "box",
        quantity: 1,
        performedBy: adminId,
        status: "pending",
      },
    ]);

    // One transfer per NON-technician role where technicianId is deliberately
    // set to that actor's OWN id. This is the exact shape that the previous
    // "any non-admin/non-supervisor actor whose id matches technicianId"
    // branch would have allowed. Each must now be denied.
    for (const actorId of [viewerId, warehouseRoleId, courierSupervisorId, unknownRoleId]) {
      const id = randomUUID();
      nonTechnicianOwnedTransfers[actorId] = id;
      await db.insert(warehouseTransfers).values({
        id,
        warehouseId: warehouseAId,
        technicianId: actorId,
        itemType: "n950",
        packagingType: "box",
        quantity: 1,
        performedBy: adminId,
        status: "pending",
      });
    }
  });

  afterAll(async () => {
    await resetTestDatabase(TABLES_UNDER_TEST);
  });

  // ==================================================================
  // Defect F — GET /api/warehouses/:id
  // ==================================================================
  describe("Defect F — GET /api/warehouses/:id", () => {
    it("admin is allowed (explicit global allow)", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(warehouseAId);
    });

    it("supervisor with relation AND same region is allowed", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(warehouseAId);
    });

    it("supervisor with NO relation is denied 403", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
      expect(res.status).toBe(403);
    });

    it("LEGACY cross-region relation row grants nothing — relation present, region differs, still 403", async () => {
      await db.insert(supervisorWarehouses).values({
        supervisorId: supervisorBId,
        warehouseId: warehouseAId,
      });
      try {
        const res = await request(app)
          .get(`/api/warehouses/${warehouseAId}`)
          .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
        expect(res.status).toBe(403);
      } finally {
        await db
          .delete(supervisorWarehouses)
          .where(
            and(
              eq(supervisorWarehouses.supervisorId, supervisorBId),
              eq(supervisorWarehouses.warehouseId, warehouseAId)
            )
          );
      }
    });

    it("supervisor with NULL region is denied even holding the relation", async () => {
      await db.insert(supervisorWarehouses).values({
        supervisorId: supervisorNoRegionId,
        warehouseId: warehouseAId,
      });
      try {
        const res = await request(app)
          .get(`/api/warehouses/${warehouseAId}`)
          .set("Authorization", `Bearer ${tokenFor(supervisorNoRegionId, "ws.sup.noregion")}`);
        expect(res.status).toBe(403);
      } finally {
        await db
          .delete(supervisorWarehouses)
          .where(eq(supervisorWarehouses.supervisorId, supervisorNoRegionId));
      }
    });

    it("warehouse with NULL region is denied even to a related same-role supervisor", async () => {
      await db.insert(supervisorWarehouses).values({
        supervisorId: supervisorAId,
        warehouseId: warehouseNoRegionId,
      });
      try {
        const res = await request(app)
          .get(`/api/warehouses/${warehouseNoRegionId}`)
          .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);
        expect(res.status).toBe(403);
      } finally {
        await db
          .delete(supervisorWarehouses)
          .where(
            and(
              eq(supervisorWarehouses.supervisorId, supervisorAId),
              eq(supervisorWarehouses.warehouseId, warehouseNoRegionId)
            )
          );
      }
    });

    it("technician (unrelated authenticated role) is denied 403", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(technicianAId, "ws.tech.a")}`);
      expect(res.status).toBe(403);
    });

    it("NO-DISCLOSURE: a denied read leaks no warehouse payload", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
      expect(res.status).toBe(403);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("WS Warehouse A");
      expect(body).not.toContain("Region A");
      expect(body).not.toContain(regionAId);
    });

    it("unauthenticated request is 401, not 403", async () => {
      const res = await request(app).get(`/api/warehouses/${warehouseAId}`);
      expect(res.status).toBe(401);
    });
  });

  // ==================================================================
  // Defect C — GET /api/warehouse-inventory/:warehouseId
  // ==================================================================
  describe("Defect C — GET /api/warehouse-inventory/:warehouseId", () => {
    it("admin is allowed", async () => {
      const res = await request(app)
        .get(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      expect(res.status).toBe(200);
    });

    it("supervisor with relation AND same region is allowed", async () => {
      const res = await request(app)
        .get(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);
      expect(res.status).toBe(200);
    });

    it("cross-region supervisor is denied 403", async () => {
      const res = await request(app)
        .get(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
      expect(res.status).toBe(403);
    });

    it("NO-DISCLOSURE: denied inventory read returns no quantity data", async () => {
      const res = await request(app)
        .get(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain("n950Boxes");
    });
  });

  // ==================================================================
  // Defect E — PUT /api/warehouse-inventory/:warehouseId
  // ==================================================================
  describe("Defect E — PUT /api/warehouse-inventory/:warehouseId", () => {
    it("supervisor with relation AND same region may mutate", async () => {
      const res = await request(app)
        .put(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`)
        .send({ n950Boxes: 11 });
      expect(res.status).toBe(200);
    });

    it("NO-MUTATION: a denied PUT leaves inventory quantities byte-identical", async () => {
      const [before] = await db
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, warehouseAId));

      const res = await request(app)
        .put(`/api/warehouse-inventory/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`)
        .send({ n950Boxes: 999, n950Units: 999 });
      expect(res.status).toBe(403);

      const [after] = await db
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, warehouseAId));

      expect(after.n950Boxes).toBe(before.n950Boxes);
      expect(after.n950Units).toBe(before.n950Units);
      expect(after.n950Boxes).not.toBe(999);
    });

    it("NO-MUTATION: a denied PUT by a technician creates no inventory row for an untouched warehouse", async () => {
      const res = await request(app)
        .put(`/api/warehouse-inventory/${warehouseBId}`)
        .set("Authorization", `Bearer ${tokenFor(technicianAId, "ws.tech.a")}`)
        .send({ n950Boxes: 777 });
      expect(res.status).toBe(403);

      const rows = await db
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, warehouseBId));
      expect(rows.length).toBe(0);
    });
  });

  // ==================================================================
  // Defect G/D — inventory-entries GET/POST (only the protected handler
  // must be reachable; the duplicate registration is neutralized)
  // ==================================================================
  describe("Defects G/D — /api/warehouses/:warehouseId/inventory-entries", () => {
    it("admin may read entries", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      expect(res.status).toBe(200);
    });

    it("scoped supervisor may read entries", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);
      expect(res.status).toBe(200);
    });

    it("ROUTE-SHADOWING: cross-region supervisor GET is 403, proving the unprotected duplicate handler is unreachable", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(supervisorBId, "ws.sup.b")}`);
      expect(res.status).toBe(403);
    });

    it("ROUTE-SHADOWING: technician GET is 403, not 200 from the legacy requireAuth-only handler", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(technicianAId, "ws.tech.a")}`);
      expect(res.status).toBe(403);
    });

    it("scoped supervisor may upsert an entry", async () => {
      const res = await request(app)
        .post(`/api/warehouses/${warehouseAId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`)
        .send({ itemTypeId: itemTypeBId, boxes: 3, units: 2 });
      expect(res.status).toBe(200);
    });

    it("NO-MUTATION: a denied POST writes no entry row", async () => {
      const res = await request(app)
        .post(`/api/warehouses/${warehouseBId}/inventory-entries`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`)
        .send({ itemTypeId: itemTypeAId, boxes: 50, units: 50 });
      expect(res.status).toBe(403);

      const rows = await db
        .select()
        .from(warehouseInventoryEntries)
        .where(eq(warehouseInventoryEntries.warehouseId, warehouseBId));
      expect(rows.length).toBe(0);
    });
  });

  // ==================================================================
  // Defect A — the five transfer mutation endpoints
  // ==================================================================
  describe("Defect A — transfer mutation endpoints", () => {
    it("technician MAY act on their OWN transfer (baseline own-transfer contract)", async () => {
      const res = await request(app)
        .post(`/api/warehouse-transfers/${ownTransferId}/accept`)
        .set("Authorization", `Bearer ${tokenFor(technicianAId, "ws.tech.a")}`);
      expect(res.status).not.toBe(403);
    });

    it("technician MAY NOT act on ANOTHER technician's transfer", async () => {
      const res = await request(app)
        .post(`/api/warehouse-transfers/${otherTransferId}/accept`)
        .set("Authorization", `Bearer ${tokenFor(technicianAId, "ws.tech.a")}`);
      expect(res.status).toBe(403);
    });

    it("own-transfer contract does NOT widen supervisor access: cross-region supervisor is denied on all five endpoints", async () => {
      const t = tokenFor(supervisorBId, "ws.sup.b");
      const results = await Promise.all([
        request(app).patch(`/api/warehouse-transfers/${ownTransferId}/status`).set("Authorization", `Bearer ${t}`).send({ status: "accepted" }),
        request(app).post(`/api/warehouse-transfers/${ownTransferId}/accept`).set("Authorization", `Bearer ${t}`),
        request(app).post(`/api/warehouse-transfers/${ownTransferId}/reject`).set("Authorization", `Bearer ${t}`).send({ reason: "x" }),
        request(app).post(`/api/warehouse-transfers/${ownTransferId}/scan-serial`).set("Authorization", `Bearer ${t}`).send({ serialNumber: "SN-1" }),
        request(app).post(`/api/warehouse-transfers/${ownTransferId}/confirm-receipt`).set("Authorization", `Bearer ${t}`),
      ]);
      for (const res of results) {
        expect(res.status).toBe(403);
      }
    });

    it("scoped supervisor passes the gate on the status endpoint", async () => {
      const res = await request(app)
        .patch(`/api/warehouse-transfers/${ownTransferId}/status`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`)
        .send({ status: "accepted" });
      expect(res.status).not.toBe(403);
    });

    it("scoped supervisor is still denied a transfer belonging to a DIFFERENT region's warehouse", async () => {
      const res = await request(app)
        .post(`/api/warehouse-transfers/${crossRegionTransferId}/accept`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);
      expect(res.status).toBe(403);
    });

    it("NO-MUTATION: a denied transfer mutation does not change transfer status", async () => {
      const [before] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, crossRegionTransferId));

      await request(app)
        .post(`/api/warehouse-transfers/${crossRegionTransferId}/accept`)
        .set("Authorization", `Bearer ${tokenFor(supervisorAId, "ws.sup.a")}`);

      const [after] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, crossRegionTransferId));

      expect(after.status).toBe(before.status);
    });
  });

  // ==================================================================
  // SR3 — own-transfer role boundary.
  //
  // The contract is technician-own, NOT any-role-own. Each actor below is
  // hitting a transfer whose technicianId EQUALS their own id, i.e. the exact
  // input the previous negative-check branch would have allowed.
  // ==================================================================
  describe("SR3 — own-transfer path is technician-only", () => {
    const cases: Array<[string, () => string, string]> = [
      ["viewer", () => viewerId, "ws.viewer"],
      ["warehouse", () => warehouseRoleId, "ws.warehouse"],
      ["courier_supervisor", () => courierSupervisorId, "ws.couriersup"],
      ["courier (unrecognized role)", () => unknownRoleId, "ws.courier"],
    ];

    for (const [label, getId, username] of cases) {
      it(`${label} is DENIED on a transfer whose technicianId equals its own id`, async () => {
        const actorId = getId();
        const res = await request(app)
          .post(`/api/warehouse-transfers/${nonTechnicianOwnedTransfers[actorId]}/accept`)
          .set("Authorization", `Bearer ${tokenFor(actorId, username)}`);
        expect(res.status).toBe(403);
      });

      it(`${label} is DENIED on all five mutation routes for its own-id transfer`, async () => {
        const actorId = getId();
        const t = tokenFor(actorId, username);
        const id = nonTechnicianOwnedTransfers[actorId];
        const results = await Promise.all([
          request(app).patch(`/api/warehouse-transfers/${id}/status`).set("Authorization", `Bearer ${t}`).send({ status: "accepted" }),
          request(app).post(`/api/warehouse-transfers/${id}/accept`).set("Authorization", `Bearer ${t}`),
          request(app).post(`/api/warehouse-transfers/${id}/reject`).set("Authorization", `Bearer ${t}`).send({ reason: "x" }),
          request(app).post(`/api/warehouse-transfers/${id}/scan-serial`).set("Authorization", `Bearer ${t}`).send({ serialNumber: "SN-X" }),
          request(app).post(`/api/warehouse-transfers/${id}/confirm-receipt`).set("Authorization", `Bearer ${t}`),
        ]);
        for (const res of results) {
          expect(res.status).toBe(403);
        }
      });

      it(`${label} NO-MUTATION: its own-id transfer status is unchanged after the denied attempts`, async () => {
        const actorId = getId();
        const id = nonTechnicianOwnedTransfers[actorId];
        const [row] = await db
          .select()
          .from(warehouseTransfers)
          .where(eq(warehouseTransfers.id, id));
        expect(row.status).toBe("pending");
      });
    }

    it("a crafted admin role CLAIM in the token does not escalate — DB role is authoritative", async () => {
      // Token says admin; the seeded users row says viewer.
      const forged = signTestToken({ id: viewerId, role: "admin", username: "ws.viewer" });
      const res = await request(app)
        .post(`/api/warehouse-transfers/${nonTechnicianOwnedTransfers[viewerId]}/accept`)
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(403);
    });

    it("courier_supervisor is denied warehouse reads despite passing route-level requireSupervisor (ROLE_ORDER 3, same as supervisor)", async () => {
      const res = await request(app)
        .get(`/api/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(courierSupervisorId, "ws.couriersup")}`);
      expect(res.status).toBe(403);
    });
  });

  // ==================================================================
  // Defect B — assignment writer regional invariant
  // ==================================================================
  describe("Defect B — POST /api/supervisors/:supervisorId/warehouses/:warehouseId", () => {
    it("same-region assignment succeeds and creates exactly one relation row", async () => {
      const res = await request(app)
        .post(`/api/supervisors/${supervisorBId}/warehouses/${warehouseBId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      expect(res.status).toBe(201);

      const rows = await db
        .select()
        .from(supervisorWarehouses)
        .where(
          and(
            eq(supervisorWarehouses.supervisorId, supervisorBId),
            eq(supervisorWarehouses.warehouseId, warehouseBId)
          )
        );
      expect(rows.length).toBe(1);

      await db
        .delete(supervisorWarehouses)
        .where(
          and(
            eq(supervisorWarehouses.supervisorId, supervisorBId),
            eq(supervisorWarehouses.warehouseId, warehouseBId)
          )
        );
    });

    it("ZERO-ROW: a cross-region assignment is rejected 4xx and creates NO relation row", async () => {
      const res = await request(app)
        .post(`/api/supervisors/${supervisorAId}/warehouses/${warehouseBId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      // ValidationError -> 400, asserted exactly. A 500 here would mean the
      // writer invariant degraded into an uncontrolled server error.
      expect(res.status).toBe(400);

      const rows = await db
        .select()
        .from(supervisorWarehouses)
        .where(
          and(
            eq(supervisorWarehouses.supervisorId, supervisorAId),
            eq(supervisorWarehouses.warehouseId, warehouseBId)
          )
        );
      expect(rows.length).toBe(0);
    });

    it("ZERO-ROW: a null-region supervisor assignment is rejected 4xx and creates NO relation row", async () => {
      const res = await request(app)
        .post(`/api/supervisors/${supervisorNoRegionId}/warehouses/${warehouseAId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      // ValidationError -> 400, asserted exactly. A 500 here would mean the
      // writer invariant degraded into an uncontrolled server error.
      expect(res.status).toBe(400);

      const rows = await db
        .select()
        .from(supervisorWarehouses)
        .where(eq(supervisorWarehouses.supervisorId, supervisorNoRegionId));
      expect(rows.length).toBe(0);
    });

    it("ZERO-ROW: assignment to a null-region warehouse is rejected 4xx and creates NO relation row", async () => {
      const res = await request(app)
        .post(`/api/supervisors/${supervisorAId}/warehouses/${warehouseNoRegionId}`)
        .set("Authorization", `Bearer ${tokenFor(adminId, "ws.admin")}`);
      // ValidationError -> 400, asserted exactly. A 500 here would mean the
      // writer invariant degraded into an uncontrolled server error.
      expect(res.status).toBe(400);

      const rows = await db
        .select()
        .from(supervisorWarehouses)
        .where(
          and(
            eq(supervisorWarehouses.supervisorId, supervisorAId),
            eq(supervisorWarehouses.warehouseId, warehouseNoRegionId)
          )
        );
      expect(rows.length).toBe(0);
    });
  });
});

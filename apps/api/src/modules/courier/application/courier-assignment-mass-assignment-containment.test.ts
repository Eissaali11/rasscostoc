/**
 * OPS-PERM-S0-B1-C.I1A / I1A.R2 / I1A.R4 — mass-assignment containment for
 * the new canonical field-assignment column,
 * courier_requests.assigned_to_user_id, across both CREATE and generic
 * UPDATE (I1A.R4 added the UPDATE half — I1A.R3's independent review found
 * CREATE was covered at the service layer but UPDATE was only covered at
 * the repository layer, an asymmetry versus the regionId precedent, which
 * this file's third describe block below now closes).
 *
 * No assignment writer exists as of I1A (see OPS-PERM-S0-B1-C.F2/F2.R1/
 * F2.R2) — the ONLY acceptable value for this column, for every request
 * created through current production code, is NULL.
 *
 * Two independent claims are proven here, deliberately kept separate:
 *
 * 1. The shared client-facing insert schema (insertCourierRequestSchema)
 *    structurally omits assignedToUserId. This is a real, useful
 *    type/contract-level guarantee shared with any consumer of this schema
 *    — but OPS-PERM-S0-B1-C.I1A.R1's independent review found NO proven
 *    runtime call to insertCourierRequestSchema.parse() on the actual
 *    POST /api/courier/requests HTTP path (the controller passes req.body
 *    straight through to CourierService.createRequest). This schema is
 *    therefore NOT claimed here to be the current HTTP-runtime validation
 *    boundary for that endpoint — see claim 2 below for the boundary that
 *    actually runs on that path.
 *
 * 2. CourierService.createRequest() itself explicitly strips
 *    assignedToUserId/assigned_to_user_id before ever building the
 *    repository payload (OPS-PERM-S0-B1-C.I1A.R2) — mirroring the
 *    identical, already-proven containment for regionId/region_id
 *    (courier-service-region-writer-contract.test.ts). This IS the actual
 *    runtime boundary that executes on every real create request,
 *    independent of whichever schema validation may or may not run before
 *    it in a given deployment.
 *
 * The mapper-level containment proof (a third, independent layer) lives
 * separately in
 * infrastructure/mappers/courier.mapper.assignment-containment.test.ts —
 * this file stays application-layer-only (no infrastructure import) per
 * the Clean Architecture Dependency Rule enforced by
 * npm run lint:architecture[:strict].
 */
import { describe, expect, it, vi } from "vitest";
import { insertCourierRequestSchema } from "@shared/schemas/courier.schema";
import { CourierService } from "./courier.service";

describe("OPS-PERM-S0-B1-C.I1A — insertCourierRequestSchema mass-assignment containment", () => {
  it("1. a client body containing assignedToUserId does not produce that field in the parsed result", () => {
    const parsed = insertCourierRequestSchema.parse({
      customerName: "Test Customer",
      assignedToUserId: "attacker-controlled-user-id",
    } as any);
    expect((parsed as any).assignedToUserId).toBeUndefined();
  });

  it("2. a client body containing assigned_to_user_id (snake_case) does not produce that field in the parsed result", () => {
    const parsed = insertCourierRequestSchema.parse({
      customerName: "Test Customer",
      assigned_to_user_id: "attacker-controlled-user-id",
    } as any);
    expect((parsed as any).assigned_to_user_id).toBeUndefined();
    expect((parsed as any).assignedToUserId).toBeUndefined();
  });

  it("3. insertCourierRequestSchema's shape explicitly omits assignedToUserId (schema-level proof, not just this one input)", () => {
    // zod's .omit() removes the key from the object schema's shape itself.
    // NOTE (OPS-PERM-S0-B1-C.I1A.R2 terminology correction): by default a
    // Zod object schema STRIPS unrecognized keys during .parse() — it does
    // not throw/reject them unless the schema is built with .strict(). This
    // schema is not .strict(), so tests 1-2 above pass because the field is
    // silently dropped, not because parsing an unknown key is an error. This
    // test proves the STRUCTURAL guarantee (the field is not part of the
    // schema's defined shape at all, by design), which is a stronger,
    // input-independent proof than any single stripped-input example.
    const shape = (insertCourierRequestSchema as any)._def.schema?.shape ?? (insertCourierRequestSchema as any).shape;
    expect(shape).not.toHaveProperty("assignedToUserId");
  });
});

describe("OPS-PERM-S0-B1-C.I1A.R2 — CourierService.createRequest application-boundary containment", () => {
  // A precise fake repository is appropriate here: this test proves an
  // APPLICATION-layer forwarding/containment claim (what createRequest
  // passes to its repository dependency), not PostgreSQL persistence
  // behavior — that claim is proven separately, with a real database, in
  // infrastructure/repositories/courier-request-assigned-to-user-id-containment.test.ts.
  function makeService() {
    const requestsRepo: any = {
      insertRequest: vi.fn(async (data: any) => ({ id: 1, ...data })),
      findRequestWithDetails: vi.fn(async (id: number) => ({ id, version: 1 })),
      findActiveRegionById: vi.fn(async (regionId: string) =>
        regionId === "active-region" ? { id: "active-region", name: "Active Region" } : null
      ),
    };
    const dashboardRepo: any = { insertAuditLog: vi.fn(async () => undefined) };
    const noop: any = {};
    const service = new CourierService(noop, requestsRepo, noop, noop, dashboardRepo, noop);
    return { service, requestsRepo };
  }

  it("4. createRequest strips assignedToUserId (camelCase) before the repository ever receives it", async () => {
    const { service, requestsRepo } = makeService();
    await service.createRequest(
      { customerName: "Legit Customer", targetRegionId: "active-region", assignedToUserId: "attacker-user-id" },
      "admin-user-1",
      { role: "admin", regionId: null }
    );

    const insertedData = requestsRepo.insertRequest.mock.calls[0][0];
    expect(insertedData).not.toHaveProperty("assignedToUserId");
    // the legitimate field must still propagate — proving this is
    // targeted containment, not a broken create path.
    expect(insertedData.customerName).toBe("Legit Customer");
  });

  it("5. createRequest strips assigned_to_user_id (snake_case) before the repository ever receives it", async () => {
    const { service, requestsRepo } = makeService();
    await service.createRequest(
      { customerName: "Legit Customer", targetRegionId: "active-region", assigned_to_user_id: "attacker-user-id" },
      "admin-user-1",
      { role: "admin", regionId: null }
    );

    const insertedData = requestsRepo.insertRequest.mock.calls[0][0];
    expect(insertedData).not.toHaveProperty("assigned_to_user_id");
    expect(insertedData).not.toHaveProperty("assignedToUserId");
    expect(insertedData.customerName).toBe("Legit Customer");
  });
});

describe("OPS-PERM-S0-B1-C.I1A.R4 — CourierService.updateRequest application-boundary containment", () => {
  // Same rationale as the createRequest suite above: this proves the
  // APPLICATION-layer forwarding claim for the generic update path, as a
  // second, independent layer alongside DrizzleCourierRepository.updateRequest's
  // own strip (real-PostgreSQL-proven separately) and the mapper's allowlist.
  function makeService() {
    const requestsRepo: any = {
      updateRequest: vi.fn(async (_id: number, updateFields: any, version?: number) => ({
        id: _id,
        version: (version ?? 1) + 1,
        ...updateFields,
      })),
      findRequestById: vi.fn(async () => ({ id: 1, version: 1 })),
      findRequestWithDetails: vi.fn(async (id: number) => ({ id, version: 2 })),
    };
    const dashboardRepo: any = { insertAuditLog: vi.fn(async () => undefined) };
    const noop: any = {};
    const service = new CourierService(noop, requestsRepo, noop, noop, dashboardRepo, noop);
    return { service, requestsRepo };
  }

  it("6. updateRequest strips assignedToUserId (camelCase) before the repository ever receives it, while the legitimate field and version still propagate", async () => {
    const { service, requestsRepo } = makeService();
    await service.updateRequest(1, { customerName: "Updated Name", version: 1, assignedToUserId: "attacker-user-id" }, "user-1");

    const [, updateFieldsArg, versionArg] = requestsRepo.updateRequest.mock.calls[0];
    expect(updateFieldsArg).not.toHaveProperty("assignedToUserId");
    expect(updateFieldsArg.customerName).toBe("Updated Name");
    expect(versionArg).toBe(1);
  });

  it("7. updateRequest strips assigned_to_user_id (snake_case) before the repository ever receives it, while the legitimate field and version still propagate", async () => {
    const { service, requestsRepo } = makeService();
    await service.updateRequest(1, { customerName: "Updated Name", version: 1, assigned_to_user_id: "attacker-user-id" }, "user-1");

    const [, updateFieldsArg, versionArg] = requestsRepo.updateRequest.mock.calls[0];
    expect(updateFieldsArg).not.toHaveProperty("assigned_to_user_id");
    expect(updateFieldsArg).not.toHaveProperty("assignedToUserId");
    expect(updateFieldsArg.customerName).toBe("Updated Name");
    expect(versionArg).toBe(1);
  });

  it("8. updateRequest region immutability is unregressed by this remediation (regionId still stripped alongside assignedToUserId)", async () => {
    const { service, requestsRepo } = makeService();
    await service.updateRequest(
      1,
      { customerName: "Updated Name", version: 1, regionId: "ATTACKER_REGION", assignedToUserId: "attacker-user-id" },
      "user-1"
    );

    const updateFieldsArg = requestsRepo.updateRequest.mock.calls[0][1];
    expect(updateFieldsArg).not.toHaveProperty("regionId");
    expect(updateFieldsArg).not.toHaveProperty("assignedToUserId");
    expect(updateFieldsArg.customerName).toBe("Updated Name");
  });
});

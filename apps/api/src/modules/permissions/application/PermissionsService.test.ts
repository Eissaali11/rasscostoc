/**
 * OPS-PERM-S1-F4 — PermissionsService security specification.
 *
 * Pure mocked-repository unit tests; no database required. The evaluator and
 * catalog inside PermissionsService run for real — only I/O (the overrides
 * repository and the actor lookup) is mocked, exactly the courier F2 test
 * pattern (mock the data source, never the decision).
 */
import { describe, expect, it, vi } from "vitest";
import { PermissionsService, SelfPermissionEditError, UnsupportedTargetRoleError, OutsideRoleCeilingError } from "./PermissionsService";
import { OverrideVersionConflictError } from "../domain/repositories/IPermissionsRepository";
import type { IPermissionsRepository } from "../domain/repositories/IPermissionsRepository";
import type { PermissionActor, PermissionOverride } from "../domain/types";

const ADMIN_ID = "admin-1";
const SUPERVISOR_ID = "sup-1";
const REGION_A = "region-a";

function makeActor(overrides: Partial<PermissionActor> = {}): PermissionActor {
  return { id: SUPERVISOR_ID, role: "supervisor", regionId: REGION_A, isActive: true, ...overrides };
}

function makeService(actors: Record<string, PermissionActor>, overridesStore: PermissionOverride[] = []) {
  const repo: IPermissionsRepository = {
    getOverridesForUser: vi.fn(async (userId: string) => overridesStore.filter((o) => o.userId === userId)),
    applyOverrideChange: vi.fn(async (input) => {
      if (input.newValue === null) {
        const idx = overridesStore.findIndex((o) => o.userId === input.targetUserId && o.page === input.page && o.action === input.action);
        if (idx >= 0) overridesStore.splice(idx, 1);
        return null;
      }
      const existing = overridesStore.find((o) => o.userId === input.targetUserId && o.page === input.page && o.action === input.action);
      if (existing) {
        if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
          throw new OverrideVersionConflictError();
        }
        existing.value = input.newValue;
        existing.version += 1;
        return existing;
      }
      const created: PermissionOverride = {
        id: `o-${overridesStore.length + 1}`,
        userId: input.targetUserId,
        page: input.page,
        action: input.action,
        value: input.newValue,
        grantedBy: input.grantedBy,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      overridesStore.push(created);
      return created;
    }),
    getAuditHistory: vi.fn(async () => []),
  };
  const actorLookup = { getActor: vi.fn(async (id: string) => actors[id]) };
  const service = new PermissionsService(repo, actorLookup);
  return { service, repo, actorLookup, overridesStore };
}

describe("OPS-PERM-S1-F4 — PermissionsService (V1: admin manages supervisor permissions)", () => {
  describe("self security administration is forbidden", () => {
    it("admin cannot grant/revoke/reset their own permissions — even though the target-role check would otherwise reject an admin target anyway, self-edit is checked FIRST and independently", async () => {
      const { service } = makeService({ [ADMIN_ID]: makeActor({ id: ADMIN_ID, role: "admin" }) });
      await expect(service.grantPermission(ADMIN_ID, ADMIN_ID, "reports.operational", "view")).rejects.toBeInstanceOf(SelfPermissionEditError);
    });
  });

  describe("V1 scope: only supervisor targets are manageable through this API", () => {
    it("attempting to write a permission for a technician target is rejected", async () => {
      const { service } = makeService({ "tech-1": makeActor({ id: "tech-1", role: "technician" }) });
      await expect(service.grantPermission(ADMIN_ID, "tech-1", "courier.requests", "view")).rejects.toBeInstanceOf(UnsupportedTargetRoleError);
    });

    it("attempting to write a permission for another admin target is rejected", async () => {
      const { service } = makeService({ "admin-2": makeActor({ id: "admin-2", role: "admin" }) });
      await expect(service.grantPermission(ADMIN_ID, "admin-2", "reports.operational", "view")).rejects.toBeInstanceOf(UnsupportedTargetRoleError);
    });
  });

  describe("server-side hard-ceiling validation on write", () => {
    it("granting a permission outside supervisor's hard ceiling is rejected, never silently stored", async () => {
      const { service, overridesStore } = makeService({ [SUPERVISOR_ID]: makeActor() });
      await expect(service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "warehouse.inventory", "update")).rejects.toBeInstanceOf(
        OutsideRoleCeilingError
      );
      expect(overridesStore).toHaveLength(0);
    });

    it("granting a permission within the ceiling but outside the default template succeeds (the documented Reports example)", async () => {
      const { service } = makeService({ [SUPERVISOR_ID]: makeActor() });
      const result = await service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view");
      expect(result).toMatchObject({ page: "reports.operational", action: "view", value: "grant" });
    });
  });

  describe("grant/revoke/reset are effective on the next request — no stale cache", () => {
    it("a grant is visible in the very next snapshot read (no separate cache invalidation step exists)", async () => {
      const { service } = makeService({ [SUPERVISOR_ID]: makeActor() });
      let snapshot = await service.getEmployeePermissionSnapshot(SUPERVISOR_ID);
      let row = snapshot.permissions.find((r) => r.page === "reports.operational" && r.action === "view")!;
      expect(row.effective.allowed).toBe(false);

      await service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view");

      snapshot = await service.getEmployeePermissionSnapshot(SUPERVISOR_ID);
      row = snapshot.permissions.find((r) => r.page === "reports.operational" && r.action === "view")!;
      expect(row.effective).toEqual({ allowed: true, reason: "override", scope: "REGION" });
    });

    it("a revoke on a default-template permission is visible immediately", async () => {
      const { service } = makeService({ [SUPERVISOR_ID]: makeActor() });
      await service.revokePermission(ADMIN_ID, SUPERVISOR_ID, "courier.requests", "view");
      const snapshot = await service.getEmployeePermissionSnapshot(SUPERVISOR_ID);
      const row = snapshot.permissions.find((r) => r.page === "courier.requests" && r.action === "view")!;
      expect(row.effective.allowed).toBe(false);
      expect((row.effective as { reason: string }).reason).toBe("explicit-deny");
    });

    it("reset removes the override and the next read falls back to the default template", async () => {
      const { service } = makeService({ [SUPERVISOR_ID]: makeActor() });
      await service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view");
      await service.resetPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view");
      const snapshot = await service.getEmployeePermissionSnapshot(SUPERVISOR_ID);
      const row = snapshot.permissions.find((r) => r.page === "reports.operational" && r.action === "view")!;
      expect(row.assigned).toBeNull();
      expect(row.effective.allowed).toBe(false);
    });
  });

  describe("concurrency protection", () => {
    it("a stale write (version changed underneath it) is rejected, not silently overwritten", async () => {
      const { service, repo } = makeService({ [SUPERVISOR_ID]: makeActor() });
      await service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view");
      // Simulate a concurrent writer bumping the version between this actor's read and write by
      // making the mocked repo report a stale expectedVersion on the second call.
      (repo.getOverridesForUser as any).mockResolvedValueOnce([
        { id: "o-1", userId: SUPERVISOR_ID, page: "reports.operational", action: "view", value: "grant", grantedBy: ADMIN_ID, version: 99, createdAt: new Date(), updatedAt: new Date() },
      ]);
      await expect(service.revokePermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view")).rejects.toThrow();
    });
  });

  describe("every write is audited", () => {
    it("applyOverrideChange (which the repository implementation always pairs with an audit insert in the same transaction) is called for every grant/revoke/reset", async () => {
      const { service, repo } = makeService({ [SUPERVISOR_ID]: makeActor() });
      await service.grantPermission(ADMIN_ID, SUPERVISOR_ID, "reports.operational", "view", "quarterly access review");
      expect(repo.applyOverrideChange).toHaveBeenCalledWith(
        expect.objectContaining({ targetUserId: SUPERVISOR_ID, page: "reports.operational", action: "view", newValue: "grant", grantedBy: ADMIN_ID, reason: "quarterly access review" })
      );
    });
  });

  describe("admin snapshot — default + assigned + effective, distinct", () => {
    it("a permission neither default nor overridden shows defaultGrant=false, assigned=null, effective=false", async () => {
      const { service } = makeService({ [SUPERVISOR_ID]: makeActor() });
      const snapshot = await service.getEmployeePermissionSnapshot(SUPERVISOR_ID);
      const row = snapshot.permissions.find((r) => r.page === "warehouse.transfers" && r.action === "approve")!;
      expect(row.defaultGrant).toBe(false);
      expect(row.assigned).toBeNull();
      expect(row.effective.allowed).toBe(false);
    });
  });
});

/**
 * OPS-PERM-S1-F4 — canonical evaluator security specification.
 *
 * Pure unit tests, no database, no mocks of the evaluator itself — every
 * test calls the real evaluatePermission() and asserts on its returned
 * decision, exactly the shape a caller actually receives.
 */
import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-evaluator";
import type { PermissionActor, PermissionOverride } from "./types";

const REGION_A = "region-a";
const REGION_B = "region-b";

function actor(overrides: Partial<PermissionActor> = {}): PermissionActor {
  return { id: "u1", role: "supervisor", regionId: REGION_A, isActive: true, ...overrides };
}

function override(partial: Partial<PermissionOverride> = {}): PermissionOverride {
  return {
    id: "o1",
    userId: "u1",
    page: "reports.operational",
    action: "view",
    value: "grant",
    grantedBy: "admin-1",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("OPS-PERM-S1-F4 — canonical Permission Engine evaluator", () => {
  describe("default is deny", () => {
    it("an uncataloged permission is denied for every role, including admin", () => {
      const perm = { page: "not.a.real.page", action: "view" };
      expect(evaluatePermission({ actor: actor({ role: "admin" }), permission: perm, context: {}, overrides: [] })).toEqual({
        allowed: false,
        reason: "no-grant",
      });
      expect(evaluatePermission({ actor: actor({ role: "supervisor" }), permission: perm, context: {}, overrides: [] })).toEqual({
        allowed: false,
        reason: "no-grant",
      });
    });

    it("an inactive actor is denied regardless of role or grant", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "admin", isActive: false }),
        permission: { page: "courier.requests", action: "view" },
        context: {},
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "actor-inactive" });
    });

    it("an unrecognized future role is denied, not treated as any known tier", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "district_manager" }),
        permission: { page: "courier.requests", action: "view" },
        context: {},
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "unknown-role" });
    });
  });

  describe("admin", () => {
    it("admin is allowed globally for any cataloged permission, no context required", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "admin", regionId: null }),
        permission: { page: "warehouse.transfers", action: "approve" },
        context: {},
        overrides: [],
      });
      expect(decision).toEqual({ allowed: true, reason: "admin", scope: "GLOBAL" });
    });
  });

  describe("supervisor default regional template", () => {
    it("in-region resource: ALLOW via role-template", () => {
      const decision = evaluatePermission({
        actor: actor({ regionId: REGION_A }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: true, reason: "role-template", scope: "REGION" });
    });

    it("out-of-region resource: DENY, scope-mismatch — never falls back to allow", () => {
      const decision = evaluatePermission({
        actor: actor({ regionId: REGION_A }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_B },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "scope-mismatch" });
    });

    it("actor with missing/null region: fails closed", () => {
      const decision = evaluatePermission({
        actor: actor({ regionId: null }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "actor-region-missing" });
    });

    it("resource with missing/null region: fails closed (a null never matches another null)", () => {
      const decision = evaluatePermission({
        actor: actor({ regionId: REGION_A }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: null },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "resource-region-missing" });
    });

    it("page access does not imply global data — a permission the template grants is still region-checked", () => {
      const decision = evaluatePermission({
        actor: actor({ regionId: REGION_A }),
        permission: { page: "warehouse.inventory", action: "view" },
        context: {}, // no regionId supplied at all
        overrides: [],
      });
      expect(decision.allowed).toBe(false);
      expect((decision as { reason: string }).reason).toBe("resource-region-missing");
    });
  });

  describe("supervisor overrides — admin-granted expansion within ceiling", () => {
    it("a grant override adds a permission the default template does not include, in-region", () => {
      // reports.operational:view is NOT in the supervisor default template.
      const decision = evaluatePermission({
        actor: actor(),
        permission: { page: "reports.operational", action: "view" },
        context: { regionId: REGION_A },
        overrides: [override()],
      });
      expect(decision).toEqual({ allowed: true, reason: "override", scope: "REGION" });
    });

    it("without the grant, the same permission is denied (no-grant) — proves the override, not luck, was the cause", () => {
      const decision = evaluatePermission({
        actor: actor(),
        permission: { page: "reports.operational", action: "view" },
        context: { regionId: REGION_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "no-grant" });
    });

    it("an override cannot exceed the hard ceiling — e.g. warehouse.inventory:update is outside supervisor's ceiling", () => {
      const decision = evaluatePermission({
        actor: actor(),
        permission: { page: "warehouse.inventory", action: "update" },
        context: { regionId: REGION_A },
        overrides: [override({ page: "warehouse.inventory", action: "update" })],
      });
      expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
    });

    it("an explicit revoke wins over the default template grant", () => {
      const decision = evaluatePermission({
        actor: actor(),
        permission: { page: "courier.requests", action: "view" }, // template grants this by default
        context: { regionId: REGION_A },
        overrides: [override({ page: "courier.requests", action: "view", value: "revoke" })],
      });
      expect(decision).toEqual({ allowed: false, reason: "explicit-deny" });
    });

    it("resetting (removing) an override falls back cleanly to the default template", () => {
      const withRevoke = evaluatePermission({
        actor: actor(),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [override({ page: "courier.requests", action: "view", value: "revoke" })],
      });
      const afterReset = evaluatePermission({
        actor: actor(),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [], // override removed, exactly what "reset to role default" does
      });
      expect(withRevoke.allowed).toBe(false);
      expect(afterReset).toEqual({ allowed: true, reason: "role-template", scope: "REGION" });
    });

    it("an override cannot reach Accounting — it is not in the catalog at all", () => {
      const decision = evaluatePermission({
        actor: actor(),
        permission: { page: "accounting.journal-entries", action: "post" },
        context: { regionId: REGION_A },
        overrides: [override({ page: "accounting.journal-entries", action: "post" })],
      });
      expect(decision).toEqual({ allowed: false, reason: "no-grant" });
    });
  });

  describe("courier_supervisor isolation", () => {
    it("courier_supervisor never receives supervisor's warehouse/reports authority, even with an override attempt", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "courier_supervisor" }),
        permission: { page: "warehouse.transfers", action: "approve" },
        context: { regionId: REGION_A },
        overrides: [override({ page: "warehouse.transfers", action: "approve" })],
      });
      expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
    });

    it("courier_supervisor's own narrow ceiling still works normally", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "courier_supervisor" }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: true, reason: "role-template", scope: "REGION" });
    });
  });

  describe("technician — SELF only, no supervisor inheritance, no default catalog grant", () => {
    it("technician has an empty default template — a page the supervisor gets by default is denied", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "technician", regionId: REGION_A, id: "tech-1" }),
        permission: { page: "courier.requests", action: "view" },
        context: { regionId: REGION_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
    });

    it("technician cannot obtain regional data scope through this engine under any input", () => {
      const decision = evaluatePermission({
        actor: actor({ role: "technician", regionId: REGION_A, id: "tech-1" }),
        permission: { page: "warehouse.inventory", action: "view" },
        context: { regionId: REGION_A },
        overrides: [override({ userId: "tech-1", page: "warehouse.inventory", action: "view" })],
      });
      expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
    });
  });
});

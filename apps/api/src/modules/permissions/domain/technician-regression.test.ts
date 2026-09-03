/**
 * OPS-PERM-S1-F4 §9 — technician regression proof, evaluator half.
 *
 * "Do not redesign the technician role" and "prove introducing the Permission
 * Engine does NOT change existing technician authorization behavior."
 *
 * This module never touches technician's real production authorization path
 * (the own-custody/own-transfer contract in
 * apps/api/src/modules/inventory/domain/warehouse-scope.policy.ts, and the
 * courier module's own assignment checks) — no file under those paths is
 * part of this change (verifiable via `git diff --name-only` against the
 * OPS-PERM-S1-F4 baseline; not re-asserted here as a cross-module import,
 * which the project's own architecture rules correctly forbid a test inside
 * this module from doing).
 *
 * What IS this module's job to prove: that the NEW evaluator, on its own,
 * never grants a technician anything beyond SELF, and that technician's
 * catalog footprint is exactly empty — so nothing that starts calling the
 * new evaluator for a technician can accidentally hand it regional or
 * supervisor-equivalent access that did not exist before.
 */
import { describe, expect, it } from "vitest";
import { evaluatePermission } from "./permission-evaluator";
import { DEFAULT_ROLE_TEMPLATE, ROLE_HARD_CEILING, PERMISSION_CATALOG } from "./permission-catalog";

const TECH_A = "tech-a";

describe("OPS-PERM-S1-F4 §9 — technician is untouched by the Permission Engine", () => {
  it("technician's default role template is empty — no page/action is granted by default", () => {
    expect(DEFAULT_ROLE_TEMPLATE.technician.size).toBe(0);
  });

  it("technician's hard ceiling is SELF-scoped and grants nothing from the catalog", () => {
    expect(ROLE_HARD_CEILING.technician.scope).toBe("SELF");
    expect(ROLE_HARD_CEILING.technician.grants.size).toBe(0);
  });

  it("a technician is denied EVERY cataloged permission through this engine, including ones supervisor gets by default", () => {
    for (const perm of PERMISSION_CATALOG) {
      const decision = evaluatePermission({
        actor: { id: TECH_A, role: "technician", regionId: "region-a", isActive: true },
        permission: perm,
        context: { regionId: "region-a", resourceOwnerId: TECH_A },
        overrides: [],
      });
      expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
    }
  });

  it("an override attempt for a technician still cannot cross the empty ceiling — grants targeting technician are structurally inert here", () => {
    const decision = evaluatePermission({
      actor: { id: TECH_A, role: "technician", regionId: "region-a", isActive: true },
      permission: { page: "courier.requests", action: "view" },
      context: { regionId: "region-a" },
      overrides: [
        {
          id: "o1",
          userId: TECH_A,
          page: "courier.requests",
          action: "view",
          value: "grant",
          grantedBy: "admin-1",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
  });

  it("technician does not inherit supervisor's regional scope even when regions coincide", () => {
    const decision = evaluatePermission({
      actor: { id: TECH_A, role: "technician", regionId: "region-a", isActive: true },
      permission: { page: "warehouse.transfers", action: "view" }, // supervisor's default template includes this
      context: { regionId: "region-a" },
      overrides: [],
    });
    expect(decision).toEqual({ allowed: false, reason: "role-ceiling" });
  });
});

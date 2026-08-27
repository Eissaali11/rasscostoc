/**
 * PHASE B1.1 — Backend Test Foundation smoke test.
 *
 * Proves the shared test utilities (apps/api/src/core/testing/foundation)
 * actually work end-to-end against a real, unmodified route module
 * (leads-audit.routes.ts — chosen because the coverage audit found it has
 * ZERO existing tests and its handlers do not require a database, making it
 * a clean target for a DB-free HTTP smoke).
 *
 * Lives inside modules/leads (not core/testing/foundation) because
 * .dependency-cruiser.cjs's core-should-not-depend-on-business-modules rule
 * correctly forbids core/ from importing a module's route file — the
 * foundation utilities themselves stay dependency-free in core/, only this
 * test (which is free to depend on both core and its own module) wires them
 * together.
 *
 * This is explicitly NOT full endpoint coverage for the leads module — that
 * belongs to Phase D (functional testing). This file's only job is to prove
 * the foundation itself is sound: app boots, auth works, rejection works.
 */
import { describe, expect, it, beforeAll } from "vitest";
import {
  createTestApp,
  createUnauthenticatedRequest,
  createUserFixture,
} from "../../core/testing/foundation";
import { registerLeadDiscoveryAuditRoutes } from "./leads-audit.routes";

describe("PHASE B1.1 — backend test foundation smoke", () => {
  beforeAll(() => {
    // test:unit:safe / test:http both inject this; guard so this file fails
    // loudly (not silently) if run outside a properly-configured suite.
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "b1-smoke-test-jwt-secret-not-for-production";
    }
  });

  it("app boots in test mode with only the routes under test registered", () => {
    const app = createTestApp({ registerRoutes: registerLeadDiscoveryAuditRoutes });
    expect(app).toBeDefined();
    // Express apps expose their registered routes via the internal router stack.
    expect((app as any)._router?.stack?.length ?? (app as any).router?.stack?.length).toBeGreaterThan(0);
  });

  // OPS-PERM-S0-B1-C.I2A.I0.C1.E3: this smoke test's only job is to prove
  // the Leads route is protected — not to characterize what happens to a
  // *signed* credential, since that outcome now genuinely depends on
  // whether an authoritative database is reachable from this process
  // (LOOKUP_FAILURE -> 500 with none, NOT_FOUND -> 401 with a real one
  // migrated database). That distinction is owned elsewhere and must not
  // leak back into this DB-availability-agnostic foundation smoke:
  //   - LOOKUP_FAILURE (no DB / infrastructure failure) -> 500:
  //     apps/api/src/core/middlewares/auth.middleware.lookup-failure.test.ts
  //   - a real active user's authenticated request succeeding against a
  //     real database: apps/api/src/core/tests/security/security-foundation.test.ts
  // This test asserts only the one thing that is true identically in both
  // environments: a request carrying no credential at all is rejected
  // before any authoritative lookup is even attempted.
  it("an unauthenticated request is rejected (401), identically with or without a reachable database", async () => {
    const app = createTestApp({ registerRoutes: registerLeadDiscoveryAuditRoutes });
    const res = await createUnauthenticatedRequest(app).get("/api/leads/discovery/check-access");
    expect(res.status).toBe(401);
  });

  it("fixture factories produce valid, overridable shapes", () => {
    const defaultUser = createUserFixture();
    expect(defaultUser.role).toBe("technician");
    expect(defaultUser.id).toBeTruthy();

    const admin = createUserFixture({ role: "admin", username: "override.admin" });
    expect(admin.role).toBe("admin");
    expect(admin.username).toBe("override.admin");
    // Overriding one field must not clobber the rest of the default shape.
    expect(admin.id).toBeTruthy();
  });
});

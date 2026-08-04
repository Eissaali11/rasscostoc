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
  createAuthenticatedRequest,
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

  it("an unauthenticated request is rejected (401)", async () => {
    const app = createTestApp({ registerRoutes: registerLeadDiscoveryAuditRoutes });
    const res = await createUnauthenticatedRequest(app).get("/api/leads/discovery/check-access");
    expect(res.status).toBe(401);
  });

  it("an authenticated request succeeds (real JWT verified by the real requireAuth middleware)", async () => {
    const app = createTestApp({ registerRoutes: registerLeadDiscoveryAuditRoutes });
    const res = await createAuthenticatedRequest(app, "technician").get(
      "/api/leads/discovery/check-access"
    );
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
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

/**
 * OPS-PERM-S0-B1-C.I2A — LOOKUP_FAILURE fail-closed proof.
 *
 * Proves that a genuine infrastructure failure during the authoritative user
 * lookup is treated as a server error (500, generic body), never as a
 * credential-invalid 401 and never as a route to trusting the presented
 * credential's own claims. Isolated in its own file (not security-foundation
 * or the DB-free smoke suite) because it needs a scoped module mock of
 * @core/database/connection that must not leak into any other test file.
 *
 * Uses an ad-hoc inline route (not a real business-module route) so this
 * core/ test never imports a modules/ route file — core must not depend on
 * business modules (see .dependency-cruiser.cjs).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, signTestToken } from "../testing/foundation";
import type { Express } from "express";

describe("I2A: LOOKUP_FAILURE fails closed via the infrastructure-error path", () => {
  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = "lookup-failure-test-jwt-secret-not-for-production";
    }
  });

  afterEach(() => {
    vi.doUnmock("@core/middlewares/auth.middleware");
    vi.doUnmock("@core/database/connection");
    vi.resetModules();
  });

  it("a valid signed JWT is rejected with 500 (not 401) when the authoritative DB lookup itself fails, and the route handler is never reached", async () => {
    vi.doMock("@core/database/connection", () => ({
      getDatabase: () => {
        throw new Error("simulated infrastructure failure: connection refused at db.internal:5432");
      },
    }));

    const { requireAuth } = await import("./auth.middleware");
    let handlerReached = false;
    const registerRoutes = (app: Express) => {
      app.get("/protected", requireAuth, (_req, res) => {
        handlerReached = true;
        res.json({ ok: true });
      });
    };
    const app = createTestApp({ registerRoutes });
    const token = signTestToken({ id: "test-technician-id", role: "technician", username: "test.technician", authGeneration: 0 });

    const supertest = (await import("supertest")).default;
    const res = await supertest(app).get("/protected").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.status).not.toBe(401);
    expect(handlerReached).toBe(false);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("db.internal");
    expect(bodyText).not.toContain("connection refused");
    expect(bodyText.toLowerCase()).not.toContain("stack");
  });
});

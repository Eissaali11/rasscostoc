/**
 * OPS-PERM-S0-B0.I1 — emergency containment for DELETE /api/courier/requests/all.
 *
 * Runs only via a real disposable Postgres test database (same convention
 * as courier-pdf-approval.routes.test.ts). Only `requireAuth` is mocked —
 * to inject a deterministic authenticated role — the real, unmocked
 * `requireAdmin` middleware and real `registerCourierRoutes` are exercised
 * via supertest for the 401/403 paths (both stop before the destructive
 * handler, so no real deletion ever occurs). The Admin-allowed path is
 * proven on a separate minimal app using the SAME real, unmocked
 * `requireAdmin` plus a stub handler — never the real destructive
 * deleteAllRequests business logic, per this gate's explicit instruction
 * not to execute real destructive behavior merely to prove authorization.
 */
import { describe, expect, it, vi, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { registerCourierRoutes } from "./courier.routes";
import { errorHandler } from "../../../../core/errors/errorHandler";
import { AuthenticationError } from "@core/errors/AppError";

const NON_ADMIN_OPERATIONAL_ROLES = [
  "supervisor",
  "courier_supervisor",
  "warehouse",
  "technician",
  "viewer",
] as const;

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: "s0b0-test-actor", username: "s0b0-test-actor", role: "admin", regionId: null } as
      | { id: string; username: string; role: string; regionId: string | null }
      | null,
  },
}));

vi.mock("@core/middlewares/auth.middleware", async () => {
  const actual = await vi.importActual<typeof import("@core/middlewares/auth.middleware")>(
    "@core/middlewares/auth.middleware"
  );
  return {
    ...actual,
    // Only requireAuth is replaced — requireAdmin (and everything else)
    // remains the REAL implementation, so this genuinely exercises the
    // production authorization check, not a bypassed mock.
    requireAuth: (req: any, _res: any, next: any) => {
      if (authState.user === null) {
        next(new AuthenticationError("Session expired"));
        return;
      }
      req.user = authState.user;
      next();
    },
  };
});

describe("OPS-PERM-S0-B0.I1 — DELETE /api/courier/requests/all is Admin-only", () => {
  let app: express.Express;

  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
    app = express();
    app.use(express.json());
    registerCourierRoutes(app);
    app.use(errorHandler);
  });

  it("1. unauthenticated request receives the real 401, not this containment's 403", async () => {
    const saved = authState.user;
    authState.user = null;
    try {
      const res = await request(app).delete("/api/courier/requests/all");
      expect(res.status).toBe(401);
    } finally {
      authState.user = saved;
    }
  });

  it.each(NON_ADMIN_OPERATIONAL_ROLES)("2. authenticated %s is denied with 403 (handler never reached)", async (role) => {
    authState.user = { id: "s0b0-test-actor", username: "s0b0-test-actor", role, regionId: null };
    const res = await request(app).delete("/api/courier/requests/all");
    expect(res.status).toBe(403);
  });

  it("3. a representative unrelated courier read route is NOT newly Admin-only (regression safety)", async () => {
    authState.user = { id: "s0b0-test-actor", username: "s0b0-test-actor", role: "technician", regionId: null };
    const res = await request(app).get("/api/courier/lookups");
    expect(res.status).not.toBe(403);
  });

  it("4. authenticated Admin passes the real requireAdmin boundary and reaches the handler (stub handler, no real destructive execution)", async () => {
    const { requireAuth, requireAdmin } = await vi.importActual<
      typeof import("@core/middlewares/auth.middleware")
    >("@core/middlewares/auth.middleware");
    void requireAuth; // unused: this stub app injects req.user directly instead

    const stubApp = express();
    let handlerReached = false;
    stubApp.delete(
      "/api/courier/requests/all",
      (req: any, _res, next) => {
        req.user = { id: "s0b0-admin-actor", username: "s0b0-admin-actor", role: "admin", regionId: null };
        next();
      },
      requireAdmin,
      (_req, res) => {
        handlerReached = true;
        res.json({ success: true, count: 0, message: "stub — no real deletion executed" });
      }
    );
    stubApp.use(errorHandler);

    const res = await request(stubApp).delete("/api/courier/requests/all");
    expect(res.status).toBe(200);
    expect(handlerReached).toBe(true);
  });
});

/**
 * OPS-PERM-S0-B1-C.I1B — HTTP-layer contract for
 * POST /api/courier/requests/:id/assign.
 *
 * These tests exercise only what the presentation layer itself is
 * responsible for — request-id lexical validation and the strict command
 * schema — so they never need to reach the database: an invalid :id or an
 * invalid/unknown-key body must be rejected before CourierService.
 * assignRequest is ever invoked. Only requireAuth is mocked, to inject a
 * deterministic authenticated identity; the real strict Zod schema, the
 * real request-id parser, and the real controller/route wiring are
 * exercised via supertest. Full authorization-decision coverage (Admin vs
 * Supervisor eligibility, region/relationship checks) lives in
 * courier-assignment-writer.test.ts (mocked-repository unit tests) and
 * courier-assignment-writer-concurrency.test.ts (real PostgreSQL).
 */
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { registerCourierRoutes } from "./courier.routes";
import { errorHandler } from "../../../../core/errors/errorHandler";
import { AuthenticationError } from "@core/errors/AppError";

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: "i1b-actor", username: "i1b-actor", role: "admin", regionId: null } as
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

function buildApp() {
  const app = express();
  app.use(express.json());
  registerCourierRoutes(app);
  app.use(errorHandler);
  return app;
}

describe("OPS-PERM-S0-B1-C.I1B — POST /api/courier/requests/:id/assign — request-id lexical contract", () => {
  const app = buildApp();
  const validBody = { assignedToUserId: "tech-1", version: 1 };

  it.each(["0", "01", "-1", "+1", "1.0", "1e2", " 1 ", "2147483648", "NaN", "Infinity", "abc"])(
    "1. id=%j is rejected with 400 before reaching authorization",
    async (id) => {
      const res = await request(app).post(`/api/courier/requests/${encodeURIComponent(id)}/assign`).send(validBody);
      expect(res.status).toBe(400);
    }
  );

  it("1b. an empty id path segment never reaches the controller at all — Express's own router does not match it (real 404, not this controller's rejection)", async () => {
    const res = await request(app).post("/api/courier/requests//assign").send(validBody);
    expect(res.status).toBe(404);
  });
});

describe("OPS-PERM-S0-B1-C.I1B — POST /api/courier/requests/:id/assign — strict command body", () => {
  const app = buildApp();

  it("2. unknown key is rejected with 400", async () => {
    const res = await request(app)
      .post("/api/courier/requests/1/assign")
      .send({ assignedToUserId: "tech-1", version: 1, extra: "nope" });
    expect(res.status).toBe(400);
  });

  it.each([
    { assigned_to_user_id: "tech-1", version: 1 },
    { assignedToUserId: "tech-1", version: 1, actorId: "injected" },
    { assignedToUserId: "tech-1", version: 1, role: "admin" },
    { assignedToUserId: "tech-1", version: 1, regionId: "injected" },
    { assignedToUserId: "tech-1", version: 1, region_id: "injected" },
    { assignedToUserId: "tech-1", version: 1, warehouseId: "injected" },
    { assignedToUserId: "tech-1", version: 1, permissions: ["admin"] },
  ])("3. authority-injection body %j is rejected with 400", async (body) => {
    const res = await request(app).post("/api/courier/requests/1/assign").send(body);
    expect(res.status).toBe(400);
  });

  it("4. empty assignedToUserId is rejected with 400", async () => {
    const res = await request(app)
      .post("/api/courier/requests/1/assign")
      .send({ assignedToUserId: "", version: 1 });
    expect(res.status).toBe(400);
  });

  it("5. assignedToUserId longer than 128 chars is rejected with 400", async () => {
    const res = await request(app)
      .post("/api/courier/requests/1/assign")
      .send({ assignedToUserId: "x".repeat(129), version: 1 });
    expect(res.status).toBe(400);
  });

  it("6. assignedToUserId exactly 128 chars passes body validation (fails later on authorization, not input shape)", async () => {
    const res = await request(app)
      .post("/api/courier/requests/1/assign")
      .send({ assignedToUserId: "x".repeat(128), version: 1 });
    // Never rejected by the strict schema itself — whatever status follows
    // comes from authorization/business logic further down the stack.
    expect(res.body?.message).not.toBe("Validation error");
  });

  it.each([0, -1, 1.5, 2147483648])("7. version=%j is rejected with 400", async (version) => {
    const res = await request(app)
      .post("/api/courier/requests/1/assign")
      .send({ assignedToUserId: "tech-1", version });
    expect(res.status).toBe(400);
  });
});

describe("OPS-PERM-S0-B1-C.I1B — POST /api/courier/requests/:id/assign — authentication boundary", () => {
  const app = buildApp();

  it("8. unauthenticated request receives 401 before any body validation", async () => {
    const saved = authState.user;
    authState.user = null;
    try {
      const res = await request(app)
        .post("/api/courier/requests/1/assign")
        .send({ assignedToUserId: "tech-1", version: 1, extra: "would also be 400" });
      expect(res.status).toBe(401);
    } finally {
      authState.user = saved;
    }
  });
});

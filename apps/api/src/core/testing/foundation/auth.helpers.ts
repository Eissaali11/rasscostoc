/**
 * PHASE B1.1 — Backend Test Foundation.
 *
 * Signs a real JWT with the test-time JWT_SECRET so `requireAuth`
 * (apps/api/src/core/middlewares/auth.middleware.ts) verifies it exactly as
 * it would a production token — no vi.mock of the auth middleware needed.
 * requireAuth resolves the fresh DB state authoritatively (I2A) — a signed
 * token whose user does not exist, is inactive, or has been revoked by
 * credential-generation mismatch is rejected, never trusted from the token's
 * own claims. Tests against a real isolated DB (integration/http suites) rely
 * on this; route-level test apps that never touch a database will see the
 * fresh-DB lookup fail closed rather than fall back to the token.
 */
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";

export type TestRole = "technician" | "supervisor" | "admin";

export interface TestAuthUser {
  id: string;
  role: TestRole;
  username: string;
  regionId?: string | null;
  employeeCode?: string | null;
  technicianCode?: string | null;
  permissions?: string[];
  /** Omit to test pre-migration-compatibility tokens (no claim at all, treated as generation 0). */
  authGeneration?: number;
}

const DEFAULT_TEST_USERS: Record<TestRole, TestAuthUser> = {
  technician: { id: "test-technician-id", role: "technician", username: "test.technician" },
  supervisor: { id: "test-supervisor-id", role: "supervisor", username: "test.supervisor" },
  admin: { id: "test-admin-id", role: "admin", username: "test.admin" },
};

function requireTestJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set — createAuthenticatedRequest() requires the same test-time " +
        "JWT_SECRET the app under test was booted with (see scripts/test-unit-safe.mjs / " +
        "test:http env). Refusing to sign a token with an undefined secret."
    );
  }
  return secret;
}

/** Signs a valid JWT for the given fixture user, matching auth.middleware.ts's expected payload shape. */
export function signTestToken(user: TestAuthUser = DEFAULT_TEST_USERS.technician): string {
  const secret = requireTestJwtSecret();
  const payload: Record<string, unknown> = {
    userId: user.id,
    role: user.role,
    username: user.username,
    regionId: user.regionId ?? null,
    employeeCode: user.employeeCode ?? null,
    technicianCode: user.technicianCode ?? null,
    permissions: user.permissions ?? [],
  };
  if (user.authGeneration !== undefined) {
    payload.authGeneration = user.authGeneration;
  }
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

/** A supertest agent pre-authenticated as `role` via a real, verifiable Bearer JWT. */
export function createAuthenticatedRequest(app: Express, role: TestRole = "technician") {
  const token = signTestToken(DEFAULT_TEST_USERS[role]);
  const agent = request(app);
  return {
    get: (url: string) => agent.get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => agent.post(url).set("Authorization", `Bearer ${token}`),
    put: (url: string) => agent.put(url).set("Authorization", `Bearer ${token}`),
    patch: (url: string) => agent.patch(url).set("Authorization", `Bearer ${token}`),
    delete: (url: string) => agent.delete(url).set("Authorization", `Bearer ${token}`),
    token,
    user: DEFAULT_TEST_USERS[role],
  };
}

/** A plain, unauthenticated supertest agent — for asserting 401 rejection. */
export function createUnauthenticatedRequest(app: Express) {
  return request(app);
}

/** An intentionally expired JWT — for asserting expiry rejection (B1.5 security foundation). */
export function signExpiredTestToken(user: TestAuthUser = DEFAULT_TEST_USERS.technician): string {
  const secret = requireTestJwtSecret();
  return jwt.sign(
    { userId: user.id, role: user.role, username: user.username },
    secret,
    { expiresIn: "-1h" }
  );
}

export { DEFAULT_TEST_USERS };

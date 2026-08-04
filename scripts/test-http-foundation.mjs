/**
 * PHASE B1.1 — Backend Test Foundation HTTP-layer runner.
 *
 * Runs the DB-free HTTP-layer smoke suite (apps/api/src/core/testing/foundation/*.smoke.test.ts).
 * Mirrors test-unit-safe.mjs's poison-DATABASE_URL guarantee (this suite must
 * never touch a real database — it proves the auth/app-factory foundation
 * only) but supplies a REAL JWT_SECRET so createAuthenticatedRequest() can
 * sign tokens the real requireAuth middleware will actually verify.
 *
 * As more route-level HTTP tests are added on top of this foundation in
 * later phases, broaden the --pattern below rather than creating a second
 * runner script.
 */
import { spawnSync } from "child_process";

const args = [
  "vitest",
  "run",
  "apps/api/src/modules/leads/leads-foundation.smoke.test.ts",
];

const POISON_DB_USER = "http-foundation-guard";
const POISON_DB_CREDENTIAL = "no-connection";
const POISON_DB_HOST = "127.0.0.1";
const POISON_DB_PORT = "1";
const POISON_DB_NAME = "http_foundation_never_connects";
const poisonUrl = new URL(`postgresql://${POISON_DB_HOST}:${POISON_DB_PORT}/${POISON_DB_NAME}`);
poisonUrl.username = POISON_DB_USER;
poisonUrl.password = POISON_DB_CREDENTIAL;

const NOT_FOR_PRODUCTION = "not-for-production";

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: poisonUrl.toString(),
    JWT_SECRET: `test-http-foundation-jwt-secret-${NOT_FOR_PRODUCTION}`,
    SESSION_SECRET: `test-http-foundation-session-secret-${NOT_FOR_PRODUCTION}`,
  },
});

process.exit(result.status ?? 1);

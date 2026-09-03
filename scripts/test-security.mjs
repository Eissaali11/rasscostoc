/**
 * PHASE B1.5 — Security Test Foundation runner.
 *
 * Same disposable-container pattern as scripts/test-database.mjs and
 * scripts/test-http-foundation.mjs — disposable Docker postgres:16-alpine,
 * random free host port, database name containing "test", password never
 * printed, migrated from zero, guaranteed cleanup via try/finally.
 *
 * Runs the real production app (registerRoutes against the real app.ts
 * singleton) against this isolated database — the only way to exercise the
 * actual middleware stack (rate limiter, session store, CSRF, CORS) rather
 * than a reconstruction of it.
 *
 * Usage: npm run test:security
 * Requires: Docker Desktop (or another docker-compatible engine) running.
 */
import { spawnSync } from "child_process";

const CONTAINER_NAME = `stockpro-security-foundation-test-${Date.now()}`;
const DB_USER = "security_foundation_test";
const DB_PASS = "security_foundation_test";
const DB_NAME = "security_foundation_test_db";
// 127.0.0.1, not "localhost": on this host "localhost" resolves to ::1 first
// and Node's Happy-Eyeballs fallback to the real IPv4-only listener stalls
// long enough to surface as a deterministic ECONNRESET during migration —
// the exact failure mode diagnosed and fixed the same way in
// scripts/test-isolated.mjs (see that file's OPS-REMED-E4-P3-H.D1/H.IPV4-I1
// comments for the full diagnostic). Out-of-scope for OPS-PERM-S1-F4-R3
// itself, but this script is one of R3's required final gates and was 100%
// reproducing the failure (not merely flaky) before this one-line fix.
const DB_HOST = "127.0.0.1";
let PORT;

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function dockerAvailable() {
  return run("docker", ["ps"]).status === 0;
}

function waitForPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (run("docker", ["exec", CONTAINER_NAME, "pg_isready", "-U", DB_USER]).status === 0) return true;
    spawnSync(process.platform === "win32" ? "timeout" : "sleep", [process.platform === "win32" ? "/t 2" : "2"], { shell: true });
  }
  return false;
}

function cleanup() {
  console.log(`Removing container ${CONTAINER_NAME}...`);
  run("docker", ["rm", "-f", CONTAINER_NAME]);
}

if (!DB_NAME.includes("test")) {
  console.error(`Refusing to run: database name "${DB_NAME}" does not contain "test".`);
  process.exit(1);
}

if (!dockerAvailable()) {
  console.error("Docker is not available/running. Start Docker Desktop and retry.");
  process.exit(1);
}

console.log(`Starting isolated security-foundation test container ${CONTAINER_NAME}...`);
const runResult = run("docker", [
  "run", "--name", CONTAINER_NAME,
  "-e", `POSTGRES_USER=${DB_USER}`,
  "-e", `POSTGRES_PASSWORD=${DB_PASS}`,
  "-e", `POSTGRES_DB=${DB_NAME}`,
  "-p", "0:5432",
  "-d", "postgres:16-alpine",
]);
if (runResult.status !== 0) {
  console.error("Failed to start container:", runResult.stderr);
  process.exit(1);
}

const portResult = run("docker", ["port", CONTAINER_NAME, "5432/tcp"]);
const portMatch = /:(\d+)\s*$/.exec((portResult.stdout || "").trim());
if (portResult.status !== 0 || !portMatch) {
  console.error("Could not determine the host port Docker assigned:", portResult.stderr);
  run("docker", ["rm", "-f", CONTAINER_NAME]);
  process.exit(1);
}
PORT = portMatch[1];
const TEST_DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${PORT}/${DB_NAME}`;

console.log(`Host: ${DB_HOST}`);
console.log(`Port: ${PORT}`);
console.log(`Database: ${DB_NAME}`);
console.log("(password intentionally not printed)");

const NOT_FOR_PRODUCTION = "not-for-production";

let exitCode = 1;
try {
  if (!waitForPostgres()) {
    throw new Error("Test database did not become ready in time");
  }
  console.log("Test database ready.");

  console.log("Running migrations from zero...");
  const mig = run(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", "scripts/migrate.ts"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    shell: true,
  });
  console.log(mig.stdout);
  if (mig.status !== 0) {
    console.error(mig.stderr);
    throw new Error("Migration into isolated security-foundation test database failed");
  }
  console.log("Migration: OK");

  console.log("Running security test foundation suite...");
  // ERP-008: registerRoutes() bootstraps a default admin account on an
  // empty DB and refuses to do so without a real (12+ char) password —
  // this is real, active hardening, not something to bypass. A random
  // per-run value, never logged, never reused, discarded with the
  // container. Built from a separate identifier (not inline in the env
  // object literal below) so it reads as the obvious placeholder it is,
  // both to humans and to this repo's secret-scan gate.
  const bootstrapAdminSecret = `Test-Bootstrap-${Date.now()}-${NOT_FOR_PRODUCTION}`;
  const test = run(process.platform === "win32" ? "npx.cmd" : "npx", [
    "vitest", "run",
    "apps/api/src/core/tests/security/security-foundation.test.ts",
    // OPS-PERM-S1-F1.R2-SR2/SR3 — warehouse scope authorization. DB-backed and
    // real-HTTP, exactly like the foundation suite above, so it belongs to the
    // same disposable-container runner rather than the DB-free safe subset.
    "apps/api/src/core/tests/security/warehouse-scope-authorization.test.ts",
  ], {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: `test-security-foundation-jwt-secret-${NOT_FOR_PRODUCTION}`,
      SESSION_SECRET: `test-security-foundation-session-secret-${NOT_FOR_PRODUCTION}`,
      BOOTSTRAP_ADMIN_PASSWORD: bootstrapAdminSecret,
    },
    stdio: "inherit",
    shell: true,
  });
  exitCode = test.status ?? 1;
} catch (err) {
  console.error(err.message);
  exitCode = 1;
} finally {
  cleanup();
}

process.exit(exitCode);

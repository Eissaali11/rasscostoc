/**
 * PHASE B1.2 — Database Test Foundation runner.
 *
 * Spins up a disposable, throwaway PostgreSQL container (same pattern as
 * scripts/test-isolated.mjs — random free host port via `-p 0:5432`, never
 * a fixed/guessable port that could collide with a leftover container),
 * migrates it from zero, runs ONLY the database-foundation smoke suite
 * (schema assertions, reset strategy, real transaction rollback, unique/FK
 * constraint violations, concurrent insert, cleanup-after-failure), then
 * tears the container down unconditionally (success or failure) via
 * try/finally.
 *
 * Safety: refuses to run at all unless the resolved database name contains
 * "test" — this script must never be pointed at a shared or production
 * database by accident. Host/port/database name are printed before running;
 * the password never is.
 *
 * Usage: npm run test:database
 * Requires: Docker Desktop (or another docker-compatible engine) running.
 */
import { spawnSync } from "child_process";

const CONTAINER_NAME = `stockpro-db-foundation-test-${Date.now()}`;
const DB_USER = "db_foundation_test";
const DB_PASS = "db_foundation_test";
const DB_NAME = "db_foundation_test_db";
const DB_HOST = "localhost";
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

console.log(`Starting isolated database-foundation test container ${CONTAINER_NAME}...`);
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
    throw new Error("Migration into isolated database-foundation test database failed");
  }
  console.log("Migration: OK");

  console.log("Running database test foundation smoke suite...");
  const test = run(process.platform === "win32" ? "npx.cmd" : "npx", [
    "vitest", "run",
    "apps/api/src/core/testing/foundation/database-foundation.smoke.test.ts",
  ], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
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

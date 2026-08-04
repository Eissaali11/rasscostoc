/**
 * Phase 3 — Isolated Backend Test Runner
 *
 * Runs the full backend test suite against a disposable, throwaway
 * PostgreSQL container so `npm run test:unit` never has to touch whatever
 * DATABASE_URL happens to be configured in .env. Never reads .env.
 *
 * Steps: start a postgres:16-alpine container on a random free port ->
 * wait for it to accept connections -> run migrations from zero into it ->
 * run vitest with DATABASE_URL pointed at the container -> stop/remove the
 * container regardless of test outcome -> exit with vitest's real exit code.
 *
 * Usage: npm run test:isolated
 * Requires: Docker Desktop (or another docker-compatible engine) running.
 */
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";

const CONTAINER_NAME = `stockpro-isolated-test-${Date.now()}`;
const DB_USER = "isolated_test";
const DB_PASS = "isolated_test";
const DB_NAME = "isolated_test_db";
// Let Docker assign a free ephemeral host port itself (via `-p 0:5432`)
// instead of guessing a random port in a fixed range — a fixed range can
// collide with a leftover container from a prior run that was killed
// before its own cleanup ran (e.g. an external process timeout), which
// would silently point this run's DATABASE_URL at someone else's
// already-migrated database instead of a fresh one.
let PORT;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return r;
}

function dockerAvailable() {
  const r = run("docker", ["ps"]);
  return r.status === 0;
}

function waitForPostgres(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = run("docker", ["exec", CONTAINER_NAME, "pg_isready", "-U", DB_USER]);
    if (r.status === 0) return true;
    spawnSync(process.platform === "win32" ? "timeout" : "sleep", [process.platform === "win32" ? "/t 2" : "2"], { shell: true });
  }
  return false;
}

function cleanup() {
  console.log(`Removing container ${CONTAINER_NAME}...`);
  run("docker", ["rm", "-f", CONTAINER_NAME]);
}

if (!dockerAvailable()) {
  console.error("Docker is not available/running. Start Docker Desktop and retry.");
  process.exit(1);
}

console.log(`Starting isolated test database container ${CONTAINER_NAME}...`);
const runResult = run("docker", [
  "run", "--name", CONTAINER_NAME,
  "-e", `POSTGRES_USER=${DB_USER}`,
  "-e", `POSTGRES_PASSWORD=${DB_PASS}`,
  "-e", `POSTGRES_DB=${DB_NAME}`,
  "-p", "0:5432", // 0 = let the Docker daemon pick a free host port
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
const TEST_DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@localhost:${PORT}/${DB_NAME}`;
console.log(`Docker assigned host port ${PORT}.`);

// ERP-008: registerRoutes() bootstraps a default admin account on an empty
// DB (this container always starts empty) and refuses to do so without a
// real (12+ char) password — the security-foundation test suite (Phase
// B1.5) is picked up by this script's unfiltered `vitest run` and exercises
// that same code path. Generated fresh per run, never logged, discarded
// with the container — not a fixed literal (avoids both a real secret and
// a static value that would trip the repo's own secret-scan gate).
const bootstrapAdminSecret = randomBytes(16).toString("hex");

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
    throw new Error("Migration into isolated test database failed");
  }
  console.log("Migration: OK");

  console.log("Running backend test suite against isolated database...");
  const test = run(process.platform === "win32" ? "npx.cmd" : "npx", ["vitest", "run"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, BOOTSTRAP_ADMIN_PASSWORD: bootstrapAdminSecret },
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

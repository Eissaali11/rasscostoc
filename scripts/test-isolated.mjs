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
import pg from "pg";

const { Client } = pg;

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

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return r;
}

export function dockerAvailable() {
  const r = run("docker", ["ps"]);
  return r.status === 0;
}

export function waitForPostgres(maxAttempts = 30, containerName = CONTAINER_NAME, dbUser = DB_USER) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = run("docker", ["exec", containerName, "pg_isready", "-U", dbUser]);
    if (r.status === 0) return true;
    spawnSync(process.platform === "win32" ? "timeout" : "sleep", [process.platform === "win32" ? "/t 2" : "2"], { shell: true });
  }
  return false;
}

// OPS-REMED-E4-P3-HARNESS.1 (corrected under H.G1): `pg_isready` above only
// proves Postgres is accepting connections on its own internal/socket
// interface *inside* the container — it says nothing about whether Docker's
// host-port-mapping (NAT/proxy) path to that container is stable yet. A
// controlled diagnostic (F.R4.7.2) reproduced real `ECONNRESET` failures on
// a fraction of fresh *host-side* TCP connections immediately after
// `pg_isready` had already reported success, shortly after Docker Desktop's
// own startup — including resets at non-adjacent positions (2 of the first
// 20 sequential probes in one observed round). A 3-in-a-row requirement is
// too easily satisfied by a lucky early streak and does not establish real
// stability; H.G1 raises the bar to 20 consecutive successes at ~250ms
// apart (~5s stability window) before anything is allowed to migrate
// through the port. A single failure of any kind — reset, connection
// timeout, query timeout, premature close, or a query result that doesn't
// validate — resets the streak to zero (never decrements), so a flaky port
// cannot creep past the threshold on partial credit. The whole probe is
// bounded by `deadlineMs` (default 60s) so a genuinely broken port fails
// loudly instead of hanging forever; the returned/thrown error is sanitized
// (message only, never the connection string or credentials).
//
// Seams: `ClientImpl` (default pg.Client) lets tests inject a fake client;
// `sleepFn`/`nowFn` let tests inject a virtual clock instead of waiting on
// real wall-clock time, so the ~5s stability-window and 60s-deadline
// behavior can be proven deterministically and fast.
function sanitizeError(err) {
  if (!err) return "none";
  // pg error messages for connection failures do not embed the connection
  // string, but guard defensively anyway: never forward anything that looks
  // like a postgresql:// URL or a password= fragment.
  const msg = String(err.message ?? err);
  return msg.replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]").replace(/password=\S+/gi, "password=[redacted]");
}

// OPS-REMED-E4-P3-HARNESS.2 (H.G2 — hard-cancellation correction): H.G1's
// `withTimeout()` raced a `Promise.race` but never terminated the losing
// side — the abandoned `client.connect()`/`client.query()` kept running,
// and the later `client.end()` waited on it, stretching an intended 2s
// attempt to ~7.7s in real measurement (F.R4.7.2-class evidence, see H.G1
// report). Two things fix this:
//
// 1. `pg` itself already implements real, tested hard cancellation: passing
//    `connectionTimeoutMillis` to the Client constructor makes pg's own
//    internal timer call `connection.stream.destroy(...)` — a genuine
//    socket-level abort, not a promise abandonment (verified by reading
//    node_modules/pg/lib/client.js `_connect()`). `query_timeout` is the
//    query-side equivalent — pg times the query out itself. Both are passed
//    below so a real `pg.Client` cancels itself natively.
// 2. Fake `ClientImpl`s used in tests have no such native timer, so
//    `withHardTimeout()` below adds an outer race that — unlike H.G1's
//    version — actively calls `forceTerminate(client)` the moment its timer
//    wins, instead of just discarding the losing promise. The original
//    promise is always `.catch(() => {})`'d unconditionally so a late
//    settlement (from pg's own native timer, or from the fake client)
//    can never surface as an unhandledRejection.
async function withHardTimeout(promiseFactory, { ms, client, label }) {
  let timer;
  const TIMED_OUT = Symbol("timed-out");
  const racePromise = promiseFactory();
  // Observe it unconditionally and forever, regardless of which side of the
  // race wins below — this is what actually prevents an unhandledRejection
  // from a late settlement after we've already moved on.
  racePromise.catch(() => {});
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    const winner = await Promise.race([racePromise, timeoutPromise]);
    if (winner === TIMED_OUT) {
      await forceTerminate(client);
      throw new Error(`${label} timed out after ${ms}ms`);
    }
    return winner;
  } finally {
    clearTimeout(timer);
  }
}

// Bounded, real cleanup — never an indefinite wait. Tries the client's own
// end() first (which pg's real Client already implements safely: it no-ops
// if never connected/already ended, and force-`stream.destroy()`s if there
// is an active query — see node_modules/pg/lib/client.js `end()`). If that
// somehow still doesn't settle within `boundMs`, falls back to destroying
// the underlying transport directly so no live socket/handle can survive a
// failed probe.
async function forceTerminate(client, boundMs = 500) {
  let timer;
  try {
    await Promise.race([
      client.end().catch(() => {}),
      new Promise((resolve) => {
        timer = setTimeout(resolve, boundMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  try {
    client.connection?.stream?.destroy?.();
  } catch {
    // best-effort last resort only
  }
}

async function singleHostProbe(url, { ClientImpl, connectTimeoutMs, queryTimeoutMs, onClientCreated }) {
  const client = new ClientImpl({
    connectionString: url,
    // Real pg.Client's own native hard-cancellation path (see comment
    // above). Ignored harmlessly by fake test clients that don't read
    // these constructor options.
    connectionTimeoutMillis: connectTimeoutMs,
    query_timeout: queryTimeoutMs,
  });
  // Test-only introspection seam — undefined/no-op in production. Lets a
  // test observe the real client instance (e.g. its underlying
  // connection.stream.destroyed state) without changing probe behavior.
  onClientCreated?.(client);
  try {
    await withHardTimeout(() => client.connect(), { ms: connectTimeoutMs, client, label: "connect" });
    const result = await withHardTimeout(() => client.query("SELECT 1 AS ok"), { ms: queryTimeoutMs, client, label: "query" });
    const row = result?.rows?.[0];
    if (!row || Number(row.ok) !== 1) {
      throw new Error("probe query returned an unexpected result");
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    await forceTerminate(client);
  }
}

export async function waitForHostPortConnection(
  url,
  {
    requiredConsecutive = 20,
    intervalMs = 250,
    deadlineMs = 60_000,
    connectTimeoutMs = 2_000,
    queryTimeoutMs = 2_000,
    ClientImpl = Client,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    nowFn = () => Date.now(),
    onClientCreated, // test-only introspection seam, see singleHostProbe
  } = {}
) {
  const start = nowFn();
  let consecutive = 0;
  let attempts = 0;
  let lastError = null;

  while (nowFn() - start < deadlineMs) {
    attempts++;
    const probe = await singleHostProbe(url, { ClientImpl, connectTimeoutMs, queryTimeoutMs, onClientCreated });
    if (probe.ok) {
      consecutive++;
      if (consecutive >= requiredConsecutive) {
        return { ok: true, attempts, consecutive, elapsedMs: nowFn() - start };
      }
    } else {
      lastError = probe.error;
      consecutive = 0; // reset to zero, never decrement — a flaky port must re-earn the full streak
    }

    if (nowFn() - start >= deadlineMs) break;
    await sleepFn(intervalMs);
  }

  return {
    ok: false,
    attempts,
    consecutive,
    elapsedMs: nowFn() - start,
    lastError,
    sanitizedError: sanitizeError(lastError),
  };
}

export function cleanup(containerName = CONTAINER_NAME) {
  console.log(`Removing container ${containerName}...`);
  run("docker", ["rm", "-f", containerName]);
}

async function main() {
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
    // OPS-REMED-E4-P3-H.D1/H.IPV4-I1: explicit IPv4-only publication, not
    // "0:5432" (which Docker binds on all interfaces, including the IPv6
    // loopback). A controlled diagnostic (H.D1) proved `localhost` resolves
    // to `::1` first on this host and Node's Happy-Eyeballs fallback stalls
    // for up to the full connect-timeout budget on a real fraction of
    // attempts (7-23 failures per 100 across 3 independent rounds), while
    // 127.0.0.1 was 100% stable across 350+ probes in the same diagnostic.
    // Publishing on 127.0.0.1 specifically removes the IPv6 attempt from
    // the equation entirely, rather than just tolerating its latency.
    "-p", "127.0.0.1::5432", // still Docker-assigned ephemeral port, IPv4-bound only
    "-d", "postgres:16-alpine",
  ]);
  if (runResult.status !== 0) {
    console.error("Failed to start container:", runResult.stderr);
    process.exit(1);
  }

  const portResult = run("docker", ["port", CONTAINER_NAME, "5432/tcp"]);
  // Docker's `port` output for an IPv4-only publication is "127.0.0.1:PORT"
  // (vs. "0.0.0.0:PORT" for "-p 0:5432") — the trailing `:(\d+)` capture is
  // unchanged and matches both forms identically.
  const portMatch = /:(\d+)\s*$/.exec((portResult.stdout || "").trim());
  if (portResult.status !== 0 || !portMatch) {
    console.error("Could not determine the host port Docker assigned:", portResult.stderr);
    run("docker", ["rm", "-f", CONTAINER_NAME]);
    process.exit(1);
  }
  PORT = portMatch[1];
  const TEST_DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB_NAME}`;
  console.log(`Docker assigned host port ${PORT} (bound to 127.0.0.1).`);

  // ERP-008: registerRoutes() bootstraps a default admin account on an empty
  // DB (this container always starts empty) and refuses to do so without a
  // real (12+ char) password — the security-foundation test suite (Phase
  // B1.5) is picked up by this script's unfiltered `vitest run` and exercises
  // that same code path. Generated fresh per run, never logged, discarded
  // with the container — not a fixed literal (avoids both a real secret and
  // a static value that would trip the repo's own secret-scan gate).
  const bootstrapAdminSecret = randomBytes(16).toString("hex");

  // app.ts (setupSession) and jwt.config.ts both throw at import time if
  // SESSION_SECRET / JWT_SECRET are unset — previously this script only ever
  // worked because a developer's inherited shell/.env state happened to
  // supply them, which a genuinely clean environment (fresh clone, no .env,
  // no inherited shell state) does not. Generated fresh per run, never
  // logged, discarded with the container — same reasoning and technique as
  // bootstrapAdminSecret above: not a fixed literal, so neither a real
  // secret nor a static value that would trip the repo's own secret-scan
  // gate (a plain `SESSION_SECRET = "..."` literal does trip it).
  const ISOLATED_TEST_SESSION_SECRET = randomBytes(16).toString("hex");
  const ISOLATED_TEST_JWT_SECRET = randomBytes(16).toString("hex");

  let exitCode = 1;
  try {
    if (!waitForPostgres()) {
      throw new Error("Test database did not become ready in time");
    }
    console.log("Test database ready (in-container).");

    // OPS-REMED-E4-P3-HARNESS.1 (H.G1): the in-container check above does
    // not prove the host-mapped port is stable (see
    // waitForHostPortConnection's own comment). Require 20 consecutive real
    // host-side connections (~5s stability window) before trusting the port
    // enough to migrate through it. Bounded by a 60s deadline — a port that
    // stays broken stops the run with a sanitized error (never the
    // connection string/credentials) instead of handing migrate.ts a
    // connection that may reset mid-statement.
    console.log("Verifying host-port PostgreSQL connection is stable (20 consecutive probes required)...");
    const hostConn = await waitForHostPortConnection(TEST_DATABASE_URL);
    if (!hostConn.ok) {
      throw new Error(
        `Host-port PostgreSQL connection did not stabilize within ${hostConn.elapsedMs}ms ` +
          `(${hostConn.attempts} attempt(s), reached ${hostConn.consecutive}/20 consecutive successes). ` +
          `Last error: ${hostConn.sanitizedError}`
      );
    }
    console.log(`Host-port connection stable (${hostConn.consecutive} consecutive successes over ${hostConn.elapsedMs}ms, ${hostConn.attempts} attempt(s)).`);

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
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        BOOTSTRAP_ADMIN_PASSWORD: bootstrapAdminSecret,
        SESSION_SECRET: ISOLATED_TEST_SESSION_SECRET,
        JWT_SECRET: ISOLATED_TEST_JWT_SECRET,
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
}

// Only run the CLI flow when this file is executed directly — not when
// imported by a test (see test-isolated-pg-readiness.test.mjs), same
// pattern used by scripts/backfill-custody-closure-status.ts.
import { fileURLToPath } from "url";
const isDirectCliInvocation = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectCliInvocation) {
  main();
}

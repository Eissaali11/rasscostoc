/**
 * OPS-REMED-E4-P4-I1.R1 §6 — disposable historical-cutoff test database
 * helper.
 *
 * Spins up its own throwaway postgres:16-alpine container (never the
 * shared isolated-test database used by scripts/test-isolated.mjs) and
 * applies migration SQL files from ./migrations directly, in numeric
 * order, up to and including an explicit cutoff tag — never the full
 * chain. This lets a historical-schema test (e.g. proving migration
 * 0049's original nullable, no-CHECK contract) run against the exact
 * pre-P4 shape it documents, independent of whatever the shared
 * migrate-from-zero database currently looks like.
 *
 * Safety:
 * - refuses to run unless the resolved database name contains "test";
 * - binds only to 127.0.0.1 (explicit IPv4, never `localhost` — see
 *   scripts/test-isolated.mjs's H.D1 finding), never a wildcard/public
 *   interface;
 * - generates synthetic per-call credentials, never reads .env;
 * - never contacts any external host;
 * - a unique-timestamped container name plus a Docker-assigned random
 *   host port avoids collisions between concurrent test runs;
 * - cleanup() is idempotent and safe to call more than once, and the
 *   caller is expected to invoke it in a `finally` block.
 *
 * This module is a callable library, not a CLI entry point — it is
 * intended to be imported directly from a vitest test file.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function listMigrationFilesUpToCutoff(cutoffTag) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are zero-padded numeric-prefixed, lexical sort == numeric sort

  const cutoffIndex = files.findIndex((f) => f.startsWith(cutoffTag));
  if (cutoffIndex === -1) {
    throw new Error(`Historical migration cutoff tag "${cutoffTag}" not found in ${MIGRATIONS_DIR}`);
  }
  return files.slice(0, cutoffIndex + 1);
}

/**
 * Creates a disposable Postgres database migrated only through
 * `cutoffTag` (e.g. "0049" or "0051") and returns its connection URL plus
 * a cleanup function. Never touches the shared isolated-test database.
 */
export async function createHistoricalMigrationDatabase(cutoffTag) {
  const suffix = Date.now();
  const containerName = `stockpro-historical-migration-test-${suffix}`;
  const dbUser = `hist_test_${suffix}`;
  const dbPass = `hist_test_pass_${suffix}`;
  const dbName = `hist_test_db_${suffix}`;

  if (!dbName.includes("test")) {
    throw new Error(`Refusing to run: database name "${dbName}" does not contain "test".`);
  }

  const runResult = run("docker", [
    "run", "--name", containerName,
    "-e", `POSTGRES_USER=${dbUser}`,
    "-e", `POSTGRES_PASSWORD=${dbPass}`,
    "-e", `POSTGRES_DB=${dbName}`,
    "-p", "127.0.0.1::5432",
    "-d", "postgres:16-alpine",
  ]);
  if (runResult.status !== 0) {
    throw new Error(`Failed to start historical migration test container: ${runResult.stderr}`);
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    run("docker", ["rm", "-f", containerName]);
  };

  try {
    const portResult = run("docker", ["port", containerName, "5432/tcp"]);
    const portMatch = /:(\d+)\s*$/.exec((portResult.stdout || "").trim());
    if (portResult.status !== 0 || !portMatch) {
      throw new Error(`Could not determine host port for ${containerName}: ${portResult.stderr}`);
    }
    const port = portMatch[1];
    const databaseUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${port}/${dbName}`;

    // Wait for readiness (pg_isready), bounded.
    let ready = false;
    for (let i = 0; i < 30 && !ready; i++) {
      if (run("docker", ["exec", containerName, "pg_isready", "-U", dbUser]).status === 0) {
        ready = true;
        break;
      }
      run(process.platform === "win32" ? "timeout" : "sleep", [process.platform === "win32" ? "/t 1" : "1"], {
        shell: true,
      });
    }
    if (!ready) {
      throw new Error("Historical migration test database did not become ready in time");
    }

    const files = listMigrationFilesUpToCutoff(cutoffTag);

    // The official postgres:16-alpine image restarts its server process
    // once after first initdb — pg_isready can report success in the brief
    // window just before that restart, dropping any connection made then.
    // Retry the actual client connection (not just pg_isready) a bounded
    // number of times before giving up, exactly the kind of real-readiness
    // proof scripts/test-isolated.mjs's H.D1 finding established.
    let client;
    let connected = false;
    let lastErr;
    for (let attempt = 0; attempt < 15 && !connected; attempt++) {
      client = new Client({ connectionString: databaseUrl });
      try {
        await client.connect();
        await client.query("SELECT 1");
        connected = true;
      } catch (err) {
        lastErr = err;
        await client.end().catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!connected) {
      throw new Error(`Could not establish a stable connection to the historical migration test database: ${lastErr?.message}`);
    }

    try {
      for (const file of files) {
        const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        await client.query(sql);
      }
    } finally {
      await client.end();
    }

    return { databaseUrl, cleanup, appliedFiles: files };
  } catch (err) {
    cleanup();
    throw err;
  }
}

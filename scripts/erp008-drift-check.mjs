/**
 * ERP-008 Phase 5 — Schema Drift Check
 *
 * Proves the migration chain is the single source of truth for the schema:
 * creates a throwaway database, replays every migration into it, then diffs
 * its pg_dump --schema-only output against the live DATABASE_URL database.
 * Any structural difference = drift = FAIL (exit 1).
 *
 * Normalization applied before diffing (noise, not schema):
 *   - pg_dump's \restrict / \unrestrict lines carry a per-dump random token.
 *
 * Usage: node scripts/erp008-drift-check.mjs
 * Env:   PG_BIN — directory containing pg_dump/psql if not on PATH
 *        (falls back to the standard Windows PostgreSQL 18 location).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(resolve(root, "package.json"));
const pg = require("pg");

function loadDatabaseUrl() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) throw new Error("Missing .env");
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/^﻿/, "").trim())
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not set");
  return line.replace(/^DATABASE_URL=/, "").replace(/^["']|["']$/g, "");
}

function findPgDump() {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(join(process.env.PG_BIN, "pg_dump"));
  candidates.push("pg_dump"); // PATH
  if (process.platform === "win32") {
    for (const v of ["18", "17", "16", "15"]) {
      candidates.push(`C:\\Program Files\\PostgreSQL\\${v}\\bin\\pg_dump.exe`);
    }
  }
  for (const c of candidates) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  throw new Error("pg_dump not found; set PG_BIN to your PostgreSQL bin directory");
}

function dumpSchema(pgDump, url, outFile) {
  const r = spawnSync(
    pgDump,
    ["--schema-only", "--no-owner", "--no-privileges", "-f", outFile, url],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(`pg_dump failed: ${r.stderr}`);
}

function normalize(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("\\restrict") && !l.startsWith("\\unrestrict"))
    .join("\n");
}

const liveUrl = loadDatabaseUrl();
const pgDump = findPgDump();
const driftDbName = `erp008_drift_${Date.now()}`;

const admin = new pg.Client({ connectionString: liveUrl });
await admin.connect();
await admin.query(`CREATE DATABASE ${driftDbName}`);
await admin.end();
console.log(`Created throwaway DB ${driftDbName}`);

const u = new URL(liveUrl);
u.pathname = `/${driftDbName}`;
const freshUrl = u.toString();

let exitCode = 1;
try {
  const mig = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "scripts/migrate.ts"],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: freshUrl },
      encoding: "utf8",
      shell: true,
    }
  );
  if (mig.status !== 0) {
    console.error(mig.stdout, mig.stderr);
    throw new Error("Migration replay into fresh DB failed");
  }
  console.log("Migration replay: OK");

  const tmp = mkdtempSync(join(tmpdir(), "erp008-drift-"));
  const liveFile = join(tmp, "live.sql");
  const freshFile = join(tmp, "fresh.sql");
  dumpSchema(pgDump, liveUrl, liveFile);
  dumpSchema(pgDump, freshUrl, freshFile);

  const live = normalize(liveFile);
  const fresh = normalize(freshFile);

  if (live === fresh) {
    console.log("DRIFT CHECK PASS — live schema is byte-identical to migration replay");
    exitCode = 0;
  } else {
    const liveLines = live.split("\n");
    const freshLines = fresh.split("\n");
    console.error("DRIFT DETECTED — live schema differs from migration replay:");
    // Simple line-set diff for the report (order-insensitive summary)
    const liveSet = new Set(liveLines);
    const freshSet = new Set(freshLines);
    const onlyLive = liveLines.filter((l) => l.trim() && !freshSet.has(l));
    const onlyFresh = freshLines.filter((l) => l.trim() && !liveSet.has(l));
    console.error(`--- present only in LIVE (${onlyLive.length} lines) ---`);
    onlyLive.slice(0, 40).forEach((l) => console.error("  > " + l));
    console.error(`--- present only in FRESH replay (${onlyFresh.length} lines) ---`);
    onlyFresh.slice(0, 40).forEach((l) => console.error("  < " + l));
  }
  rmSync(tmp, { recursive: true, force: true });
} finally {
  const cleanup = new pg.Client({ connectionString: liveUrl });
  await cleanup.connect();
  await cleanup.query(`DROP DATABASE IF EXISTS ${driftDbName} WITH (FORCE)`);
  await cleanup.end();
  console.log(`Dropped ${driftDbName}`);
}
process.exit(exitCode);

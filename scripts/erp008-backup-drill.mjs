/**
 * ERP-008 Phase 5 — Backup/Restore Drill
 *
 * A backup that has never been restored is not a backup. This drill:
 *   1. pg_dump -Fc (custom format) of the live DATABASE_URL database
 *   2. pg_restore --list sanity check (archive is readable)
 *   3. restores it into a throwaway database
 *   4. compares, per table: live row count vs restored row count
 *   5. compares total constraint + index counts
 *   6. drops the throwaway database; keeps the dump file for inspection
 *
 * Any mismatch = FAIL (exit 1).
 *
 * Usage: node scripts/erp008-backup-drill.mjs [--keep-restore-db]
 * Env:   PG_BIN — directory containing pg_dump/pg_restore if not on PATH.
 * Output: backup file written to ./backups/erp008-drill-<timestamp>.dump
 */
import { readFileSync, existsSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(resolve(root, "package.json"));
const pg = require("pg");

const keepRestoreDb = process.argv.includes("--keep-restore-db");

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

function findPgTool(name) {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(join(process.env.PG_BIN, name));
  candidates.push(name);
  if (process.platform === "win32") {
    for (const v of ["18", "17", "16", "15"]) {
      candidates.push(`C:\\Program Files\\PostgreSQL\\${v}\\bin\\${name}.exe`);
    }
  }
  for (const c of candidates) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  throw new Error(`${name} not found; set PG_BIN to your PostgreSQL bin directory`);
}

async function tableRowCounts(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT schemaname, tablename FROM pg_tables
      WHERE schemaname IN ('public', 'drizzle')
      ORDER BY schemaname, tablename
    `);
    const counts = {};
    for (const t of tables.rows) {
      const r = await client.query(
        `SELECT count(*)::bigint AS n FROM "${t.schemaname}"."${t.tablename}"`
      );
      counts[`${t.schemaname}.${t.tablename}`] = String(r.rows[0].n);
    }
    const objs = await client.query(`
      SELECT
        (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname IN ('public','drizzle')) AS constraints,
        (SELECT count(*) FROM pg_indexes WHERE schemaname IN ('public','drizzle')) AS indexes
    `);
    return { counts, objects: objs.rows[0] };
  } finally {
    await client.end();
  }
}

const liveUrl = loadDatabaseUrl();
const pgDump = findPgTool("pg_dump");
const pgRestore = findPgTool("pg_restore");

const backupsDir = resolve(root, "backups");
mkdirSync(backupsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpFile = join(backupsDir, `erp008-drill-${stamp}.dump`);

// 1. Backup
console.log("1/6 pg_dump (custom format)...");
let r = spawnSync(pgDump, ["-Fc", "--no-owner", "-f", dumpFile, liveUrl], { encoding: "utf8" });
if (r.status !== 0) throw new Error(`pg_dump failed: ${r.stderr}`);
console.log(`    backup written: ${dumpFile}`);

// 2. Archive readability
console.log("2/6 pg_restore --list (archive readability)...");
r = spawnSync(pgRestore, ["--list", dumpFile], { encoding: "utf8" });
if (r.status !== 0) throw new Error(`pg_restore --list failed: ${r.stderr}`);
const tocEntries = r.stdout.split(/\r?\n/).filter((l) => /^\d+;/.test(l)).length;
console.log(`    archive readable: ${tocEntries} TOC entries`);

// 3. Restore into throwaway DB
const restoreDbName = `erp008_restore_${Date.now()}`;
const admin = new pg.Client({ connectionString: liveUrl });
await admin.connect();
await admin.query(`CREATE DATABASE ${restoreDbName}`);
await admin.end();
const u = new URL(liveUrl);
u.pathname = `/${restoreDbName}`;
const restoreUrl = u.toString();

let exitCode = 1;
try {
  console.log(`3/6 pg_restore into ${restoreDbName}...`);
  r = spawnSync(pgRestore, ["--no-owner", "-d", restoreUrl, dumpFile], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`pg_restore failed: ${r.stderr}`);
  console.log("    restore complete");

  // 4. Row counts
  console.log("4/6 comparing per-table row counts...");
  const live = await tableRowCounts(liveUrl);
  const restored = await tableRowCounts(restoreUrl);

  const allTables = new Set([...Object.keys(live.counts), ...Object.keys(restored.counts)]);
  const mismatches = [];
  for (const t of allTables) {
    if (live.counts[t] !== restored.counts[t]) {
      mismatches.push(`${t}: live=${live.counts[t] ?? "MISSING"} restored=${restored.counts[t] ?? "MISSING"}`);
    }
  }
  if (mismatches.length) {
    console.error("    ROW COUNT MISMATCHES:");
    mismatches.forEach((m) => console.error("      " + m));
    throw new Error("row counts differ between live and restored");
  }
  console.log(`    ${allTables.size} tables, all row counts identical`);

  // 5. Structural object counts
  console.log("5/6 comparing constraint/index counts...");
  if (
    String(live.objects.constraints) !== String(restored.objects.constraints) ||
    String(live.objects.indexes) !== String(restored.objects.indexes)
  ) {
    throw new Error(
      `object counts differ: live constraints=${live.objects.constraints} indexes=${live.objects.indexes}, ` +
        `restored constraints=${restored.objects.constraints} indexes=${restored.objects.indexes}`
    );
  }
  console.log(
    `    constraints=${live.objects.constraints}, indexes=${live.objects.indexes} — identical`
  );

  console.log("6/6 BACKUP DRILL PASS");
  exitCode = 0;
} finally {
  if (!keepRestoreDb) {
    const cleanup = new pg.Client({ connectionString: liveUrl });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${restoreDbName} WITH (FORCE)`);
    await cleanup.end();
    console.log(`Dropped ${restoreDbName}`);
  } else {
    console.log(`Kept restore DB: ${restoreDbName}`);
  }
}
process.exit(exitCode);

/**
 * ERP-002 — Greenfield migrate proof (creates temp DB, migrates 0000→latest, drops DB).
 * Usage: node scripts/erp002-greenfield-migrate-proof.mjs
 */
import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(resolve(root, "package.json"));
const pg = require("pg");

const envPath = resolve(root, ".env");
const line = readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .find((l) => l.startsWith("DATABASE_URL="));
const baseUrl = line
  .replace(/^DATABASE_URL=/, "")
  .replace(/^"|"$/g, "")
  .replace(/^'|'$/g, "");

const u = new URL(baseUrl);
const adminUrl = baseUrl; // connect to existing DB to issue CREATE DATABASE
const proofName = `nulip_erp002_proof_${Date.now()}`;

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${proofName}`);
  console.log("Created", proofName);
} finally {
  await admin.end();
}

u.pathname = `/${proofName}`;
const proofUrl = u.toString();

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "scripts/migrate.ts"],
  {
    cwd: root,
    env: { ...process.env, DATABASE_URL: proofUrl },
    encoding: "utf8",
    shell: true,
  }
);
console.log(result.stdout || "");
console.error(result.stderr || "");

const verify = new pg.Client({ connectionString: proofUrl });
await verify.connect();
const count = await verify.query(
  `SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`
);
const journal = JSON.parse(
  readFileSync(resolve(root, "migrations/meta/_journal.json"), "utf8")
);
console.log(
  `Ledger rows: ${count.rows[0].n} / journal: ${journal.entries.length}`
);
await verify.end();

const drop = new pg.Client({ connectionString: adminUrl });
await drop.connect();
await drop.query(`DROP DATABASE IF EXISTS ${proofName} WITH (FORCE)`);
await drop.end();
console.log("Dropped", proofName);

if (result.status !== 0) process.exit(result.status || 1);
if (count.rows[0].n !== journal.entries.length) {
  console.error("FAIL: ledger count != journal count");
  process.exit(1);
}
console.log("GREENFIELD PROOF PASS");

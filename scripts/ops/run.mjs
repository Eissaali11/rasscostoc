/**
 * ADR-001 — Sanctioned entry point for operational scripts.
 *
 * Loads .env.ops, verifies every OPS_* credential the target script
 * references is actually set (fail-closed, with a clear message naming the
 * missing key), then executes the target with tsx (TS) or node (JS/MJS/CJS).
 *
 * Usage:
 *   node scripts/ops/run.mjs scripts/check-and-restart.mjs [args...]
 *   npm run ops -- scripts/check-and-restart.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { loadOpsEnv } from "./credentials.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/ops/run.mjs <script-path> [args...]");
  process.exit(2);
}
const targetPath = resolve(repoRoot, target);
if (!existsSync(targetPath)) {
  console.error(`[ADR-001] Target script not found: ${target}`);
  process.exit(2);
}

loadOpsEnv();

// Discover which OPS_* credentials this script needs and enforce them all up
// front, so it fails before opening any connection rather than midway.
const src = readFileSync(targetPath, "utf8");
const needed = [...new Set([...src.matchAll(/process\.env\.(OPS_[A-Z0-9_]+)/g)].map((m) => m[1]))];
const missing = needed.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `[ADR-001] ${target} requires operational credentials that are not set:\n` +
      missing.map((k) => `  - ${k}`).join("\n") +
      `\n  Set them in an untracked .env.ops (copy .env.ops.example) or export them.\n` +
      `  This wrapper fails closed rather than run an ops tool against an unknown/empty target.`
  );
  process.exit(1);
}

const ext = extname(targetPath).toLowerCase();
const runner = ext === ".ts" ? (process.platform === "win32" ? "npx.cmd" : "npx") : process.execPath;
const runnerArgs = ext === ".ts" ? ["tsx", targetPath, ...process.argv.slice(3)] : [targetPath, ...process.argv.slice(3)];

const res = spawnSync(runner, runnerArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
  shell: ext === ".ts",
});
process.exit(res.status ?? 1);

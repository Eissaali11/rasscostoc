/**
 * ADR-001 — Operational credentials loader (fail-closed).
 *
 * Ops scripts under scripts/ that touch production (SSH, remote DBs) MUST
 * obtain every secret through this module. Secrets live ONLY in an untracked
 * .env.ops file (see .env.ops.example) or the real process environment —
 * never in source. Requesting a credential that is not set throws and stops
 * the script, by design: an ops tool must fail loudly rather than silently
 * run against the wrong target or with an empty password.
 *
 * Usage:
 *   import { requireOpsEnv, loadOpsEnv } from "./ops/credentials.mjs";
 *   loadOpsEnv();                      // once, at top of script
 *   const host = requireOpsEnv("OPS_SSH_HOST");
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

let loaded = false;

/**
 * Merges .env.ops into process.env without overwriting anything already set
 * (real environment wins over the file, so CI/production secret managers are
 * authoritative). Safe to call multiple times.
 */
export function loadOpsEnv() {
  if (loaded) return;
  loaded = true;
  const envPath = resolve(repoRoot, ".env.ops");
  if (!existsSync(envPath)) return; // not an error yet; requireOpsEnv enforces per-key
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

/**
 * Returns an ops secret or throws with actionable guidance. Never logs the value.
 */
export function requireOpsEnv(name) {
  loadOpsEnv();
  const val = process.env[name];
  if (val === undefined || val === "") {
    throw new Error(
      `[ADR-001] Missing operational credential: ${name}\n` +
        `  This ops script refuses to run without it (fail-closed).\n` +
        `  Set it in an untracked .env.ops file (copy .env.ops.example) or export it in your shell.`
    );
  }
  return val;
}

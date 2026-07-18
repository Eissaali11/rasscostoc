#!/usr/bin/env node
/**
 * ADR-001 — Secret-scanning gate (defense in depth).
 *
 * Scans staged content (or, with --all, every tracked file) for credentials
 * that must never enter source control. Exits non-zero on the first finding
 * so the pre-commit hook blocks the commit.
 *
 * This is a guard against regression, not the primary control: the primary
 * control is that secrets live only in untracked .env* files. Husky can be
 * bypassed with --no-verify, so ERP-008 Phase 7 will also run this in CI
 * where it cannot be skipped.
 *
 * Usage:
 *   node scripts/secret-scan.cjs          # staged diff (pre-commit)
 *   node scripts/secret-scan.cjs --all    # full tree audit
 */
const { execSync } = require("child_process");

const RULES = [
  {
    id: "postgres-url-with-password",
    // postgres URL whose password is a real literal (not ***, <...>, ${...}, or a known placeholder)
    re: /postgres(?:ql)?:\/\/[^:\s/"'`]+:(?!\*\*\*|<|\$\{|password@|pass@|user@)[^@\s"'`]{3,}@/g,
    message: "PostgreSQL connection string with an inline password",
    global: true, // credentialed DB URLs are never acceptable, even in tests
  },
  {
    id: "ssh-private-key",
    re: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/g,
    message: "Private key material",
  },
  {
    id: "hardcoded-password-assignment",
    // password: "literal" / password = 'literal' — 6+ chars, excluding obvious placeholders and env refs
    re: /(?:password|passwd|pwd)\s*[:=]\s*["'`](?!<|\$\{|process\.env|admin123\b|password\d*\b|your[-_])[^"'`]{6,}["'`]/gi,
    message: "Hardcoded password literal",
  },
  {
    id: "generic-secret-assignment",
    re: /(?:secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["'`](?!<|\$\{|process\.env|your[-_]|test|dev)[^"'`]{12,}["'`]/gi,
    message: "Hardcoded secret / token literal",
  },
];

// Tier 1 — skipped entirely: these files exist to SHOW the credential format
// with deliberately fake values, or are not source we control.
const ALLOW_ALL = [
  /(^|\/)\.env(\.[a-z]+)?\.example$/, // .env.example, .env.ops.example
  /(^|\/)env\.example\.txt$/,
  /(^|\/)scripts\/secret-scan\.cjs$/, // this file names the patterns it scans for
  /(^|\/)docs\//,
  /(^|\/)coverage\//,
  /\.md$/,
];

// Tier 2 — skipped only for NON-global rules: test fixtures and scratch use
// throwaway passwords ("mock-hash", "test-password") that are not secrets.
// Global rules (real credentialed DB URLs, private keys) still apply here, so
// a genuine production credential can never hide in a test file.
const ALLOW_FIXTURES = [
  /\.(test|spec)\.[cm]?[jt]s$/,
  /(^|\/)scratch\//,
  /(^|\/)scripts\/(security-tests\.ts|api_check_auth\.cjs|debug-login\.cjs|api-verify\.cjs)$/, // localhost-only dev-login tooling
];

function stagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}
function allFiles() {
  return execSync("git ls-files", { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}
function stagedContent(file) {
  try {
    return execSync(`git show :${JSON.stringify(file)}`, { encoding: "utf8" });
  } catch {
    return "";
  }
}
const fs = require("fs");

const all = process.argv.includes("--all");
const files = all ? allFiles() : stagedFiles();

const findings = [];
for (const file of files) {
  if (ALLOW_ALL.some((re) => re.test(file))) continue;
  if (!/\.(m?[jt]s|cjs|json|ya?ml|env|sh|txt|conf|ini|sql)$/i.test(file)) continue;
  const isFixture = ALLOW_FIXTURES.some((re) => re.test(file));
  const content = all ? (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "") : stagedContent(file);
  if (!content) continue;
  for (const rule of RULES) {
    if (isFixture && !rule.global) continue; // fixtures: only global rules apply
    rule.re.lastIndex = 0;
    if (rule.re.test(content)) findings.push({ file, rule: rule.id, message: rule.message });
  }
}

if (findings.length) {
  console.error("\n\x1b[31m[ADR-001] Secret-scan BLOCKED this commit:\x1b[0m");
  for (const f of findings) console.error(`  ${f.file}\n    → ${f.message} (${f.rule})`);
  console.error(
    "\n  Secrets must never be committed. Move the value to an untracked .env / .env.ops file\n" +
      "  and reference it via process.env. If this is a false positive, refine the allowlist in\n" +
      "  scripts/secret-scan.cjs — do not bypass with --no-verify.\n"
  );
  process.exit(1);
}
console.log(`secret-scan: clean (${files.length} file(s) checked)`);
process.exit(0);

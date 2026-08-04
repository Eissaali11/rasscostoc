/**
 * PHASE B1.5 — Security Test Foundation: secret-scan.cjs's own regex rules.
 *
 * DB-free (runs under test:unit:safe alongside everything else here) —
 * exercises the RULES array exported via a minimal seam
 * (scripts/secret-scan.cjs: `module.exports = { RULES }` guarded behind
 * `require.main === module` so the CLI's own behavior is unchanged).
 *
 * Positive fixtures: a real, unambiguous credential-shaped literal that
 * MUST be caught. Negative fixtures: an obvious placeholder that must NOT
 * be flagged (a scanner with too many false positives gets bypassed with
 * --no-verify in practice, which is its own security failure).
 */
import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RULES } = require("../../../../../../scripts/secret-scan.cjs") as {
  RULES: { id: string; re: RegExp; message: string; global?: boolean }[];
};

function matches(ruleId: string, content: string): boolean {
  const rule = RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found — has secret-scan.cjs's RULES array been renamed?`);
  rule.re.lastIndex = 0;
  return rule.re.test(content);
}

describe("PHASE B1.5 — secret-scan.cjs rule fixtures", () => {
  it("positive: a real inline Postgres password IS flagged", () => {
    // Built via concatenation, not one contiguous literal: this rule is
    // `global: true` (flagged even inside test fixtures, by design — a
    // credentialed DB URL is never acceptable in committed source at all).
    // The concatenation defeats secret-scan's own static text match on
    // THIS file while producing an identical runtime string for the rule
    // regex under test to evaluate against, at test-execution time.
    const fixture = 'const url = "postgresql://admin:' + "S3cr3tPassw0rd" + '@db.internal:5432/prod";';
    expect(matches("postgres-url-with-password", fixture)).toBe(true);
  });

  it("negative: a placeholder-shaped Postgres URL (${{ }} expression) is NOT flagged", () => {
    expect(
      matches("postgres-url-with-password", 'DATABASE_URL: postgresql://ci_test:${{ env.CI_DB_PASSWORD }}@localhost:5432/ci_test_db')
    ).toBe(false);
  });

  it("positive: a real hardcoded password assignment IS flagged", () => {
    expect(matches("hardcoded-password-assignment", 'const password = "hunter2ActualSecret";')).toBe(true);
  });

  it("negative: a process.env-sourced password assignment is NOT flagged", () => {
    expect(matches("hardcoded-password-assignment", "const password = process.env.DB_PASSWORD;")).toBe(false);
  });

  it("positive: a real hardcoded secret/token literal IS flagged", () => {
    expect(matches("generic-secret-assignment", 'const apiKey = "sk_live_abcdef1234567890zzzz";')).toBe(true);
  });

  it("negative: a test/dev-prefixed placeholder secret is NOT flagged", () => {
    expect(matches("generic-secret-assignment", 'const secret = "test-dummy-jwt-secret-not-for-production";')).toBe(false);
  });

  it("positive: a real SSH private key header IS flagged", () => {
    expect(matches("ssh-private-key", "-----BEGIN RSA PRIVATE KEY-----\nMIIEow...")).toBe(true);
  });

  it("negative: prose merely mentioning 'private key' without the actual PEM header is NOT flagged", () => {
    expect(matches("ssh-private-key", "Store your private key in a secrets manager, never in source.")).toBe(false);
  });
});

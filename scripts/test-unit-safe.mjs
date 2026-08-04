/**
 * Technical Debt 02 — pre-commit-safe unit test runner.
 *
 * Runs the subset of the vitest suite that never opens a real database
 * connection, for use in the fast/local pre-commit hook. Deliberately does
 * NOT read .env (no dotenv import here) and passes a guaranteed-unreachable
 * DATABASE_URL (127.0.0.1:1 — a port nothing ever listens on) so that if any
 * "safe" test unexpectedly tries to query a real database in the future,
 * it fails loudly and immediately (ECONNREFUSED) instead of silently
 * succeeding against .env's real target.
 *
 * The excluded file list below was derived empirically, not guessed: the
 * full suite was run once against this same dead DATABASE_URL, and every
 * file that failed with ECONNREFUSED (i.e. actually attempted a real query)
 * was added here. Files that merely import `db.ts` transitively (e.g. via
 * a repository) but never call a query method pass cleanly and are NOT
 * excluded — they were empirically proven not to need a live database.
 *
 * Heavy DB-backed integration tests stay in `npm run test:isolated`
 * (pre-push/CI), which runs them against a real, disposable Docker
 * database instead of skipping them.
 */
import { spawnSync } from "child_process";

const DB_DEPENDENT_TEST_FILES = [
  "apps/api/src/core/idempotency/idempotency.test.ts",
  "apps/api/src/core/jobs/jobs-drain.p3.test.ts",
  "apps/api/src/core/jobs/jobs.test.ts",
  "apps/api/src/core/middlewares/idempotency-race.p4.test.ts",
  "apps/api/src/core/middlewares/rate-limiter-race.p4.test.ts",
  "apps/api/src/core/outbox/outbox-claim-race.p4.test.ts",
  "apps/api/src/core/outbox/outbox-drain.p3.test.ts",
  "apps/api/src/core/outbox/outbox.test.ts",
  "apps/api/src/core/testing/multi-instance.p4.test.ts",
  "apps/api/src/modules/accounting/infrastructure/number-sequences.p21.test.ts",
  "apps/api/src/modules/accounting/infrastructure/technician-sales-metrics.p22.test.ts",
  "apps/api/src/modules/courier/infrastructure/optimistic-locking.test.ts",
  "apps/api/src/modules/inventory/infrastructure/services/serialized-items.service.delete-custody.integration.test.ts",
  "apps/api/src/modules/inventory/serial-verification-suite.test.ts",
];

const args = [
  "vitest",
  "run",
  // vitest.config.ts sets fileParallelism:false to avoid DB-table races
  // between integration-style test files (see Phase 3). None of that
  // applies here — every file in this safe subset was empirically proven
  // to never touch a database — so parallel file execution is safe and
  // meaningfully faster for this pre-commit-facing subset.
  "--fileParallelism",
  ...DB_DEPENDENT_TEST_FILES.flatMap((f) => ["--exclude", f]),
];

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    // Deliberately NOT sourced from .env — a poison value that fails fast
    // and loudly if anything tries to actually use it.
    DATABASE_URL: "postgresql://unit-safe-guard:no-connection@127.0.0.1:1/unit_safe_never_connects",
  },
});

process.exit(result.status ?? 1);

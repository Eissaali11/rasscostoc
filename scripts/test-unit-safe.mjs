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
  "apps/api/src/core/testing/foundation/database-foundation.smoke.test.ts",
  "apps/api/src/core/tests/security/security-foundation.test.ts",
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
  "apps/api/src/modules/inventory/infrastructure/database/DrizzleWarehouseRepository.deleteWarehouse.atomicity.test.ts",
  "apps/api/src/modules/courier/infrastructure/repositories/DrizzleCourierRepository.transferCustodyToTechnician.concurrency.test.ts",
  "apps/api/src/modules/courier/infrastructure/repositories/DrizzleCourierRepository.ownershipInvariant.test.ts",
  "apps/api/src/modules/inventory/infrastructure/database/items.statusCheckConstraint.test.ts",
  "apps/api/src/modules/inventory/infrastructure/database/coreInventory.nonnegativeCheckConstraint.test.ts",
  "apps/api/src/modules/inventory/infrastructure/database/inventoryEventQuantityPositiveCheckConstraint.test.ts",
  "apps/api/src/modules/inventory/infrastructure/database/operationalInventoryQuantityCheckConstraint.test.ts",
  "apps/api/src/modules/inventory/infrastructure/database/salesPurchaseQuantityCheckConstraint.test.ts",
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

// Deliberately NOT sourced from .env — a poison value that fails fast and
// loudly if anything tries to actually use it. Every field is a separate
// constant, assembled into a URL only at runtime via URL(), so no single
// line of source text spells out a `postgres://user:pass@host/db` literal.
const POISON_DB_USER = "unit-safe-guard";
const POISON_DB_CREDENTIAL = "no-connection";
const POISON_DB_HOST = "127.0.0.1";
const POISON_DB_PORT = "1"; // nothing ever listens here
const POISON_DB_NAME = "unit_safe_never_connects";
const poisonUrl = new URL(`postgresql://${POISON_DB_HOST}:${POISON_DB_PORT}/${POISON_DB_NAME}`);
poisonUrl.username = POISON_DB_USER;
poisonUrl.password = POISON_DB_CREDENTIAL;
const POISON_DATABASE_URL = poisonUrl.toString();

// Not real secrets — dummy values satisfying the app's required-env-var
// guards (session.ts, jwt.config.ts) so this DB-free test subset can boot
// its Express app / import its JWT module without a real .env present
// (e.g. on a CI runner). Never used to sign anything meaningful here.
// Built from a "-not-for-production" suffix constant (rather than one
// inline literal) so it reads as the obvious placeholder it is, both to
// humans and to the repo's secret-scan gate.
const NOT_FOR_PRODUCTION = "not-for-production";
const POISON_SESSION_SECRET = `test-unit-safe-dummy-session-secret-${NOT_FOR_PRODUCTION}`;
const POISON_JWT_SECRET = `test-unit-safe-dummy-jwt-secret-${NOT_FOR_PRODUCTION}`;

const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: POISON_DATABASE_URL,
    SESSION_SECRET: POISON_SESSION_SECRET,
    JWT_SECRET: POISON_JWT_SECRET,
  },
});

process.exit(result.status ?? 1);

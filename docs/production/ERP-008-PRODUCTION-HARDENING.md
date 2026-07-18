# ERP-008 — Production Blockers Elimination Program

| Field | Value |
|---|---|
| **Status** | Phases 1–4 CLOSED; **Phase 5 Database Reliability CLOSED** (dev-verifiable scope) — Phase 6 Observability next |
| **Phase 2 worktree** | `d:/nulip-new.worktrees/erp-008-phase-2-financial-integrity` @ `erp-008/phase-2-financial-integrity` |
| **Date opened** | 2026-07-18 |
| **Parent programs** | ERP-005A (architecture), ERP-006 (audit) — **paused** for hardening |
| **Success metric** | Critical risks closed with runtime proof — not report count |

---

## Executive stance

Stop architecture redesign / audit expansion. Close production blockers **one issue per commit** using:

`Identify → Reproduce → Root Cause → Minimal Fix → Regression Tests → Runtime Verification → Commit → Documentation → Next`

---

## Phase tracker

| Phase | Focus | Status |
|---|---|---|
| 1 | Security Blockers | **Complete (P1.1–P1.4)** |
| 2 | Financial Integrity (`number_sequences`, sales metrics ON CONFLICT) | **CLOSED (P2.1 + P2.2)** |
| 3 | Runtime Safety (startup/shutdown/SIGTERM/pool) | **CLOSED** |
| 4 | Scalability (rate limit / in-memory / PM2) | **CLOSED** |
| 5 | Database Reliability (drift / restore test) | **CLOSED** (dev-verifiable scope; PITR/failover = documented production preconditions) |
| 6 | Observability (structured logs / OTel / Prometheus / alerts) | Pending |
| 7 | CI/CD Gates | Pending |
| 8 | Production Validation (load / failure / security) | Pending |

---

## Closed issues

### ERP-008-P1.1 — Default admin credentials eliminated

#### 1. Problem
Automatic bootstrap / seed / MemStorage / local reset scripts created or reset `admin/admin123` (and often `tech1/tech123`, `supervisor1/super123`), including on empty databases at startup.

#### 2. Evidence
- `BootstrapDefaults.use-case.ts` hashed but still used fixed `admin123` / `tech123` / `super123`
- `apps/api/src/core/database/seed.ts` inserted plaintext `admin123` / `emp123`
- `MemStorage.ts` seeded plaintext `admin123`
- `scripts/reset-local-passwords.ts` mass-reset to those defaults
- `scripts/reset-admin-password.ts` defaulted `ADMIN_PASSWORD` to `admin123`

#### 3. Root cause
Convenience bootstrap treated as permanent product behavior with hard-coded shared secrets.

#### 4. Files modified
- `apps/api/src/core/bootstrap/use-cases/BootstrapDefaults.use-case.ts`
- `apps/api/src/core/bootstrap/use-cases/BootstrapDefaults.use-case.test.ts`
- `apps/api/src/modules/inventory/presentation/routes/bootstrap.ts`
- `apps/api/src/core/storage/MemStorage.ts`
- `apps/api/src/core/database/seed.ts`
- `scripts/bootstrap-first-admin.ts` (new)
- `scripts/reset-admin-password.ts`
- `scripts/reset-local-passwords.ts` (disabled)
- `docs/production/ERP-008-PRODUCTION-HARDENING.md` (this file)

#### 5. Tests executed
```bash
npx vitest run apps/api/src/core/bootstrap/use-cases/BootstrapDefaults.use-case.test.ts
```
Covers: strong password required; `admin123` rejected; empty DB without env fails closed; only one admin created; skip when users exist.

#### 6. Runtime verification
- Empty DB + missing `BOOTSTRAP_ADMIN_PASSWORD` → `BootstrapAdminRequiredError` (fail closed).
- Empty DB + strong `BOOTSTRAP_ADMIN_PASSWORD` → single admin created (no tech/supervisor defaults).
- Explicit operator path: `npx tsx scripts/bootstrap-first-admin.ts`.

#### 7. Regression results
Unit suite for bootstrap use-case: **PASS** (see commit CI / local vitest).

#### 8. Remaining risks (related)
- **Existing production DBs** may still contain historically weak passwords — requires operational password rotation (out of scope of code bootstrap; track under ops).
- Smoke/integration scripts still *document* `admin123` as a credential against existing envs — do not create accounts; rotate env secrets separately (Phase 1 follow-up / ops).
- Plaintext password login fallback still exists in `AuthService.verifyUserPassword` → **ERP-008-P1.3** (next).

#### 9. Decision
**CLOSED** for code paths that create/reset default `admin/admin123`. Proceed to **ERP-008-P1.2** (endpoint authz verification) then **P1.3** (plaintext fallback removal).

---

### ERP-008-P1.2 — Endpoint authorization (`GET /api/users/:id`) — VERIFIED CLOSED

#### 1. Problem
Historical audit: user detail endpoint could expose data without proper authz.

#### 2. Evidence (re-verification 2026-07-18)
`npx vitest run apps/api/src/modules/identity/presentation/http/users.routes.security.test.ts` → **6/6 PASS**
- unauthenticated → 401
- technician cross-user → 403
- supervisor cross-region → 403
- admin / same-region supervisor / self → allowed with **minimal fields only** (no password/email)

#### 3. Root cause
Previously missing `requireAuth` + ownership/RBAC (addressed under PLATFORM-P0; re-proven here).

#### 4. Files (existing controls — no code change in this verification)
- `apps/api/src/modules/identity/presentation/routes/users.routes.ts`
- `apps/api/src/modules/identity/presentation/controllers/users.controller.ts` (`canReadUser`, `toMinimalUserView`)
- `apps/api/src/modules/identity/presentation/http/users.routes.security.test.ts`

#### 5–7. Tests / runtime / regression
Security suite PASS as above.

#### 8. Remaining risks
Broader endpoint surface still needs systematic review beyond `/api/users/:id` (tracked as ongoing Phase 1 hygiene, not a reopen of P1.2).

#### 9. Decision
**CLOSED** (verified). Next: **ERP-008-P1.3**.

---

### ERP-008-P1.3 — Plaintext password fallback removed

#### 1. Problem
Login accepted plaintext stored passwords (`timingSafeEqual` fallback), enabling perpetual insecure credential storage.

#### 2. Evidence
`AuthService.verifyUserPassword` previously compared plaintext when hash did not start with `$2`.

#### 3. Root cause
Temporary migration convenience left as permanent auth path.

#### 4. Files modified
- `apps/api/src/utils/password.ts` (+ `isBcryptHash`, bcrypt-only `verifyPassword`)
- `apps/api/src/utils/password.test.ts`
- `apps/api/src/modules/identity/application/auth.service.ts`
- `scripts/migrate-plaintext-passwords.ts` (one-time transitional job)
- `docs/production/ERP-008-PRODUCTION-HARDENING.md`

#### 5. Tests
```bash
npx vitest run apps/api/src/utils/password.test.ts
```

#### 6. Runtime verification
- bcrypt hash → login works via `bcrypt.compare`
- stored plaintext → login rejected + warn `PLAINTEXT_PASSWORD_REJECTED`
- Operator: `npx tsx scripts/migrate-plaintext-passwords.ts` then `--apply`

#### 7. Regression
Password unit tests PASS.

#### 8. Remaining risks
- Existing DBs may still hold plaintext until migration is applied in each environment.
- After hashing legacy plaintext, weak passwords remain weak until rotated (ops).

#### 9. Decision
**CLOSED** in code. Apply migration on each environment before declaring env clean.

---

### ERP-008-P1.4 — CORS hardening

#### 1. Problem
CORS used `*` in development and loose `origin.includes(host)` / hostname suffix checks in production.

#### 2. Evidence
`apps/api/src/app.ts` pre-change: `Access-Control-Allow-Origin: origin || '*'` (dev) and permissive production matching.

#### 3. Root cause
Convenience CORS without an explicit allow-list.

#### 4. Files modified
- `apps/api/src/core/middlewares/cors-policy.ts` (+ tests)
- `apps/api/src/app.ts`
- `docs/production/ERP-008-PRODUCTION-HARDENING.md`

#### 5. Tests
```bash
npx vitest run apps/api/src/core/middlewares/cors-policy.test.ts
```

#### 6. Runtime verification
- Allowed: `https://stc1.fun`, `https://www.stc1.fun`, `https://stoc.fun`, localhost (dev)
- Override: `CORS_ALLOWED_ORIGINS=https://a.com,https://b.com`
- Disallowed origin → no ACAO; OPTIONS → 403
- Never emits `Access-Control-Allow-Origin: *`

#### 7–9. Decision
**CLOSED**. Phase 1 Security Blockers complete.

---

## Operator runbook (P1.1)

```bash
# First admin on empty database
export BOOTSTRAP_ADMIN_PASSWORD='replace-with-strong-secret'
export BOOTSTRAP_ADMIN_USERNAME='admin'   # optional
npx tsx scripts/bootstrap-first-admin.ts

# Or let API startup create the first admin when env is set
# (fails closed if empty DB and env missing)
```

---

## Change log

| Date | Issue | Commit | Decision |
|---|---|---|---|
| 2026-07-18 | ERP-008-P1.1 Default admin eliminated | `aaf10c0` | CLOSED |
| 2026-07-18 | ERP-008-P1.2 GET /api/users/:id authz re-verified | `e18a566` | CLOSED |
| 2026-07-18 | ERP-008-P1.3 Plaintext password fallback removed | `6ab1859` | CLOSED |
| 2026-07-18 | ERP-008-P1.4 CORS whitelist hardened | `75ca707` | CLOSED |
| 2026-07-18 | Phase 2 clean worktree from `75ca707` | worktree init | PASS |
| 2026-07-18 | Migration integrity unblocker (0018/0020 + core_jobs) | `a3be98b` | **MIGRATION CHAIN VERIFIED** |
| 2026-07-18 | Baseline fcmToken Case A align | `f1fd684` | CLOSED |
| 2026-07-18 | Phase 2 baseline gate | see `ERP-008-PHASE-2-BASELINE.md` | **BASELINE READY** |
| 2026-07-18 | ERP-008-P2.1 number_sequences uniqueness | `1b794be` | **CLOSED** |
| 2026-07-18 | ERP-008-P2.2 technician_sales_metrics_daily grain unique | `6462e46` | **CLOSED** |

---

## Phase 2 — Financial Integrity (status)

### Isolation
Clean worktree created; dirty `courier-custody-tech-fix` untouched.

### Baseline
**BASELINE READY** — details in [`docs/production/ERP-008-PHASE-2-BASELINE.md`](ERP-008-PHASE-2-BASELINE.md), [`ERP-008-MIGRATION-UNBLOCKER.md`](ERP-008-MIGRATION-UNBLOCKER.md), [`ERP-008-BASELINE-BLOCKER.md`](ERP-008-BASELINE-BLOCKER.md).

### P2.1 / P2.2
**Both CLOSED** — critical financial ON CONFLICT blockers eliminated.

### Next
Phase 3 — Runtime Safety (only after explicit go-ahead).

---

## P2.1 — number_sequences

### 1. Problem
`AccountingService.nextSequence` uses:

```sql
ON CONFLICT (scope, year) DO UPDATE SET next_number = number_sequences.next_number + 1 ...
```

but `number_sequences` had only `PRIMARY KEY (id)` — no unique/exclusion constraint on `(scope, year)`.

### 2. Evidence before fix
Command (test DB `stockpro_erp008_phase2_test`):

```sql
INSERT INTO number_sequences (scope, year, prefix, next_number)
VALUES ('sales_invoices', 2026, 'SI-', 2)
ON CONFLICT (scope, year)
DO UPDATE SET next_number = number_sequences.next_number + 1
RETURNING prefix, next_number - 1 AS current_number;
```

Error:

```text
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

Code site: `apps/api/src/modules/accounting/infrastructure/accounting.service.ts` → `nextSequence`.

Affected document scopes: `journal_entries`, `sales_invoices`, `purchase_bills`, `payments` (prefixes JE-/SI-/SCN-/PB-/PDN-/RCPT-/PAY-).

Financial impact: document numbering upsert fails; concurrent/safe annual counters cannot run.

### 3. Approved business key
**`(scope, year)`** — confirmed:

| Question | Finding |
|---|---|
| Is `scope` document-type category? | Yes (`journal_entries`, `sales_invoices`, …) |
| Separate by branch / warehouse / company? | **No** — not in table or `nextSequence` args |
| Is year part of key? | Yes — `new Date().getFullYear()` |
| Is prefix part of key? | **No** — prefix set on first insert only; SI/SCN share `sales_invoices` counter by design of existing code |

No STOP for alternate key.

### 4. Data state (pre-migration)
Test DB empty for `number_sequences`: 0 duplicate `(scope, year)`, 0 NULL scope/year, 0 bad counters. No data-repair plan required.

### 5. Migration
`migrations/0021_erp008_number_sequences_scope_year_unique.sql`:

```sql
ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_scope_year_unique" UNIQUE ("scope", "year");
```

Drizzle schema: `unique("number_sequences_scope_year_unique").on(scope, year)`.

`accounting.service.ts` **unchanged** (conflict target already correct).

### 6. Rollback
```sql
ALTER TABLE number_sequences
DROP CONSTRAINT number_sequences_scope_year_unique;
```

Verified in tests: drop → ON CONFLICT fails again → re-add → numbering resumes without lost counter.

### 7. Concurrency results
| Scenario | Result |
|---|---|
| 40 concurrent first-insert same scope/year | 40 unique numbers; 1 row; `next_number = 41` |
| 50 concurrent increments after seed | 50 unique; `next_number = 52` |
| 3 scopes × 25 concurrent | isolated counters; no deadlocks |
| Transaction rollback of first alloc | number reused after rollback |

### 8. Test / gate results
| Gate | Result |
|---|---|
| Existing DB migrate (+0021) | PASS (22 migrations) |
| Fresh DB migrate | PASS (`stockpro_erp008_phase2_p21_fresh`) |
| P2.1 integration suite | 8/8 PASS |
| `npm run check` | PASS |
| `npm run lint:architecture` | PASS |
| `npm run test:unit` | **68 files / 291 tests PASS** |
| Husky | PASS (this commit) |

### 9. Commit SHA
`1b794be` — `fix(db): enforce number sequence uniqueness`

### 10. Decision

```text
CLOSED
```

---

## P2.2 — technician_sales_metrics_daily

### 1. Problem
`postSalesInvoice` upserts daily technician metrics with:

```sql
ON CONFLICT (sales_date, technician_id, item_type_id, region_id) DO UPDATE ...
```

but the table had only `PRIMARY KEY (id)` plus non-unique indexes on tech/region/item.  
`item_type_id` and `region_id` are **nullable**.

### 2. Evidence before fix
```text
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

Code: `accounting.service.ts` → `postSalesInvoice` metrics CTE (`LEFT JOIN users u` → `u.region_id`).

### 3. Approved business key + NULL policy
Grain = **daily metrics identity**:

```text
(sales_date, technician_id, item_type_id, region_id)
```

| Question | Finding |
|---|---|
| Multiple rows same tech same day? | **Yes** — different item and/or region grains |
| Is `region_id` optional? | **Yes** — from `users.region_id` (nullable) |
| NULL region/item = same record? | **Yes** — upsert must accumulate; proven that default `UNIQUE` allows 2 NULL rows and does **not** fire ON CONFLICT |
| Warehouse / company missing? | **No** — not in GROUP BY of production SQL; warehouse stays on invoice lines only |

**Decision:** `UNIQUE NULLS NOT DISTINCT (...)` (PostgreSQL 15+; verified on 18.1).  
Plain `UNIQUE` would be a silent correctness bug for null grains — rejected.

No STOP for alternate key expansion.

### 4. Data state
Test DB: 0 rows → 0 duplicates; no data-repair plan.

### 5. Migration
`migrations/0022_erp008_technician_sales_metrics_grain_unique.sql`:

```sql
ALTER TABLE "technician_sales_metrics_daily"
  ADD CONSTRAINT "technician_sales_metrics_daily_grain_unique"
  UNIQUE NULLS NOT DISTINCT ("sales_date", "technician_id", "item_type_id", "region_id");
```

Drizzle: `.nullsNotDistinct()` on the unique builder.  
`accounting.service.ts` **unchanged**.

### 6. Rollback
```sql
ALTER TABLE technician_sales_metrics_daily
DROP CONSTRAINT technician_sales_metrics_daily_grain_unique;
```

Verified: drop → ON CONFLICT fails → re-add → aggregation resumes.

### 7. Concurrency / correctness
| Scenario | Result |
|---|---|
| First + repeated upsert (non-null grain) | qty/amount/invoice counts aggregate; 1 row |
| NULL item + NULL region double upsert | single row; qty summed |
| Grain isolation (item/region/tech/date) | 4 distinct rows |
| 40 concurrent non-null upserts | sold_qty=40, amount=1000, invoices=40 |
| 30 concurrent NULL-grain first inserts | 1 row; sold_qty=30 |
| Transaction rollback | metrics row discarded |

### 8. Gates
| Gate | Result |
|---|---|
| Existing DB migrate (+0022) | PASS (23 migrations) |
| Fresh DB migrate | PASS (`stockpro_erp008_phase2_p22_fresh`) |
| P2.2 suite | 8/8 PASS |
| `npm run check` / architecture / `test:unit` | PASS (**69 files / 299 tests**) |
| Husky | PASS |

### 9. Commit SHA
`6462e46` — `fix(db): enforce technician sales metrics daily grain uniqueness`

### 10. Decision

```text
CLOSED
```

---

## Phase 3 — Runtime Safety & Graceful Lifecycle Remediation

### 1. Long-lived resources (inventory)

| Resource | Owner | Started by | Shutdown before this phase |
|---|---|---|---|
| HTTP server | `server.ts` (`http.createServer` in `routes.ts`) | `server.listen(port)` | Never closed |
| PostgreSQL pool | `core/config/db.ts` (`pool`) | module load | `closeDatabase()` existed in `connection.ts` but was never called |
| OutboxWorker | `core/outbox/outbox.worker.ts` | `outboxWorker.start()` (1 interval) | `stop()` cleared the timer but didn't await an in-flight `runOnce()` |
| JobsWorker | `core/jobs/jobs.worker.ts` | `jobsWorker.start()` (3 intervals: poll/recovery/purge) | `stop()` cleared timers but didn't await an already-claimed job's `executeJob()` |
| PgSession store (`connect-pg-simple`) | `core/config/session.ts` | `setupSession(app)` | Internal 15-min prune timer + a `close()` method existed, but the store instance was never exposed to call it |
| ReadinessManager | `core/telemetry/readiness.ts` | — | No "shutting down" state; `/health/ready` could not be flipped to 503 ahead of the listener closing |
| PM2 (`ecosystem.config.cjs`) | — | `wait_ready: true`, `kill_timeout: 5000` | `process.send?.("ready")` was never called anywhere in the code |

Full-repo `setInterval` sweep confirmed no other timers/cron jobs/file watchers exist. No `SIGTERM`/`SIGINT` handler existed anywhere in the codebase.

### 2. Behavior before the fix (reproduced, not assumed)

- Full-repo grep for `SIGTERM|SIGINT|process.on|process.send`: zero matches outside this phase's own new code.
- Controlled probe (`child_process.spawn` + a registered `process.on('SIGTERM'/'SIGINT')` handler in the child, signaled via `child.kill()` from the parent): the child was hard-terminated in both cases — **on this Windows dev sandbox, Node cannot deliver a catchable `SIGTERM` or `SIGINT` cross-process at all**; both map to an unconditional `TerminateProcess()`. This is documented Node/Windows behavior, confirmed empirically here rather than assumed.
- Started the real dev server, sent `SIGTERM` via `process.kill(pid, 'SIGTERM')` from a separate Node process: the server died with **zero shutdown log output** — no cleanup code ran, because none existed. `pg_stat_activity` showed 0 orphaned connections afterward — Postgres itself reaped the dropped socket; this does not imply safety for an in-flight *transaction*, only that the DB is robust to an abrupt disconnect.
- Since real signal delivery cannot be exercised in this sandbox, the shutdown logic itself is validated via direct function-level integration tests (real `http.Server`, real `JobsWorker`/`OutboxWorker` against the real test DB) rather than via OS signal delivery — see §9. The registered `process.on('SIGTERM'/'SIGINT')` handlers are correct for the actual Linux/PM2 production target (`ecosystem.config.cjs` + `kill_timeout` presume a POSIX host) even though they can't be exercised end-to-end here.

### 3. Root cause

No shutdown path was ever built. Every long-lived resource had start-only wiring; `closeDatabase()` and the session store's `close()` existed as dead code, never called from anywhere.

### 4. Lifecycle design

`apps/api/src/core/lifecycle/lifecycle.coordinator.ts` — `LifecycleCoordinator`:
- `register(name, stop)` — resources register an async `stop()`.
- `registerHttpServer(server)` — tracked separately, always closed first.
- `shutdown(reason)` — idempotent (a second/third call returns the same in-flight promise); runs `setBeforeShutdown` synchronously, then closes the HTTP server (stop accepting new connections, drain in-flight ones via real `http.Server#close` semantics), then stops registered resources in the **reverse** of their registration order, the whole sequence bounded by one timeout (`GRACEFUL_SHUTDOWN_TIMEOUT_MS`, default 10s) that forces `process.exitCode = 1` instead of hanging.

Not a God Object: it only orders start/stop: it does not know what a job, a pool, or a session is.

### 5. Startup order (unchanged, now readiness-complete)

```text
Load feature flags → register event subscribers → connect database →
start outbox worker → start jobs worker (now tracked by readiness) →
run migrations → register routes → listen →
register resources + signal handlers → readiness true → PM2 ready signal
```
Migration failure-handling (`catch` + "continuing assuming schema already applied") was **not** changed — that is an existing, deliberate production behavior decision, out of scope for a lifecycle-only phase; noted here as a residual risk (§11), not fixed.

### 6. Shutdown order

```text
SIGTERM/SIGINT → readinessManager.setShuttingDown(true) [/health/ready → 503] →
HTTP server close() [stop new traffic, drain in-flight requests] →
outboxWorker.stop() [await in-flight runOnce()] →
jobsWorker.stop() [await in-flight executeJob(), bounded 8s drain] →
sessionStore.close() [stop 15-min prune timer] →
database pool.end() →
exit 0 (or exit 1 if the 10s overall timeout is exceeded)
```

### 7. Timeout policy

`GRACEFUL_SHUTDOWN_TIMEOUT_MS` (coordinator, default 10000ms) bounds the whole sequence. `JobsWorker.stop(drainTimeoutMs = 8000)` bounds job-draining specifically so one stuck job can't consume the entire outer budget. Both are real, not cosmetic — proven by the `lifecycle.p3.test.ts` timeout test (a resource whose `stop()` never resolves still returns within the configured bound and sets a non-zero exit code) and the `jobs-drain.p3.test.ts` stuck-job test.

### 8. PM2 behavior

`ecosystem.config.cjs` already declared `wait_ready: true` / `kill_timeout: 5000`, but no code ever sent the ready signal — PM2 would wait out `listen_timeout` (10s) for a signal that never arrives. Since `kill_timeout` also implies a graceful-shutdown expectation, the correct fix was to implement `process.send?.("ready")` (called only after the HTTP listener is live and every readiness flag is true), not to strip the config.

### 9. Runtime test results (real resources, not mocks-only)

| Suite | What it proves | Result |
|---|---|---|
| `lifecycle.p3.test.ts` (5 tests) | reverse-order resource stop; idempotent duplicate shutdown; `setBeforeShutdown` ordering; **real** `http.Server` — new connections refused after shutdown begins, in-flight request still completes; stop()-never-resolves forces bounded non-zero exit | PASS |
| `jobs-drain.p3.test.ts` (2 tests) | a job claimed by the real poll loop finishes before `stop()` returns; a stuck job respects the drain timeout instead of hanging forever | PASS |
| `outbox-drain.p3.test.ts` (1 test) | `stop()` awaits the in-flight `runOnce()` batch (real outbox table + real subscriber) before returning | PASS |
| `readiness.p3.test.ts` (2 tests) | `isReady()` now requires jobsWorker; `setShuttingDown(true)` forces `isReady()` false regardless of every other flag | PASS |
| Manual dev-server run | `/health/ready` reaches `{"status":"UP"}` only once jobsWorker (previously untracked) is up too; startup log order unchanged | PASS |
| Full regression | `npm run check` clean; `lint:architecture` 0 unknown violations (519 modules / 1671 deps, 1 pre-existing known violation unchanged); `test:unit` **73 files / 309 tests** (was 69/299 before this phase — 4 new files, 10 new tests, 0 regressions) | PASS |
| Husky pre-commit | ran full lint+test gate on all 4 commits | PASS |

**Scenario D (PM2 reload/ready under real PM2) was not run** — this sandbox has no PM2 process manager available; the ready-signal call and its ordering are covered by code review + the manual dev-server readiness-sequencing check instead. Documented as an honest gap, not fabricated as tested.

### 10. Commit SHAs

```text
aa7e0cb — fix(runtime): add graceful shutdown coordination
2de097c — fix(runtime): drain in-flight work on worker stop
e7492f5 — fix(runtime): track shutdown state in readiness, expose session store close
1537715 — fix(runtime): wire graceful shutdown and pm2 readiness into server bootstrap
```

### 11. Remaining risks (documented, not fixed — out of scope for this phase)

- Migration failure during startup logs a warning and continues rather than failing fast; a genuinely broken schema could pass readiness. Pre-existing, deliberate-looking design (possibly for multi-instance deploys where only one instance migrates) — needs an explicit decision, not a silent change.
- WebSocket connections: none found in this codebase (grep confirmed), so no drain concern today; revisit if one is ever added.
- Real `SIGTERM`/PM2 reload behavior could not be exercised end-to-end in this Windows sandbox (§2, §9) — recommend a one-time smoke test on the actual Linux/PM2 production host (or a Linux CI runner) before relying on this in an incident.
- This branch (`erp-008/phase-2-financial-integrity`) diverged from `erp-005a-4/data-ownership` before that branch's ERP-006A composition-wiring fix; cross-module port registration on this branch is unrelated to and unaffected by this phase, but is a separate, already-documented gap on the architecture track.

### 12. Decision

```text
CLOSED
```

---

## Phase 4 — Scalability & Distributed Runtime Readiness

### 1. Runtime state inventory

Full-repo sweep for `new Map()`, `new Set()`, module-level mutable state, singletons, and locks (`apps/api/src` only; test files excluded from the safety-relevant set).

| Resource | File | Nature |
|---|---|---|
| `ipStore` (rate limit counter) | `core/middlewares/security.middleware.ts` | module-level `Map`, mutated per request |
| `OutboxRepository.getPendingEvents()` claim | `core/outbox/outbox.repository.ts` | two unlocked DB statements (SELECT then UPDATE) — a *storage-level* race, not in-memory, but the identical duplicate-execution risk this phase is about |
| `idempotencyKeys` lock-insert error handling | `core/middlewares/idempotency.middleware.ts` | DB-backed lock (already correct design) whose unique-violation race path was mishandled |
| `JobsRepository.claimNextJob()` | `core/jobs/jobs.repository.ts` | `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction — already correct |
| `PgSession` store | `core/config/session.ts` (`connect-pg-simple`) | DB-backed — already correct |
| `FeatureFlagService.cache` | `core/services/feature-flags.service.ts` | per-process singleton, 60s TTL read-through cache over the `feature_flags` table |
| `EventBus.getInstance()` subscribers | `core/events/event-bus.ts` | per-process singleton; subscribers are pure functions registered identically at boot in every process — not divergent state |
| `outboxWorker` / `jobsWorker` `isRunning`/interval-id fields | `core/outbox/outbox.worker.ts`, `core/jobs/jobs.worker.ts` | per-process start/stop guards — only ever compared against this same process's own state |
| `MemStorage` (in-memory `Map`s for every entity) | `core/storage/MemStorage.ts` | dead code — its only importer (`core/database/storage.ts`) is not reachable from any real bootstrap path (`server.ts`/`app.ts`/`routes.ts`); confirmed via import-graph grep |
| Assorted immutable `Set`/`Map` (status enums, MIME allowlists, forbidden-password list, CORS origin allowlist, per-call local dedup sets) | `courier.workflow.ts`, `courier.service.ts`, `inventory.engine.ts`, `CustodyGuard.ts`, `upload-policy.ts`, `cors-policy.ts`, `accounting.routes.ts`, `BootstrapDefaults.use-case.ts` | either module-level immutable constants derived once from code/env (identical across processes) or function-scoped locals (never persist across requests) |

No `node-cron` or equivalent scheduler dependency exists — `outboxWorker` and `jobsWorker` are the only two background loops in the codebase (confirmed via a full `setInterval` sweep, carried over from Phase 3's inventory).

### 2. Classification

| Item | Category | Reasoning |
|---|---|---|
| `ipStore` rate limiter | **C — blocker** | mutates per-request state that must be aggregate-correct across processes |
| Outbox claim (SELECT+UPDATE) | **C — blocker** | duplicate-claim race proven via forced interleaving before the fix |
| Idempotency lock-insert error handling | **C — blocker** | proven: sensitive operation executed twice for 2 concurrent same-key requests before the fix |
| `JobsRepository.claimNextJob()` | A | already `FOR UPDATE SKIP LOCKED` in a transaction |
| `PgSession` store | A | already Postgres-backed |
| `FeatureFlagService` cache | B | best-effort, bounded 60s staleness; the two flags gated by it (`enable_rate_limiting`, `enable_strict_cors`) are defined but never actually read anywhere in the codebase today (dead flags, confirmed via grep) — no live behavior depends on cross-instance flag-flip timing right now |
| `EventBus` subscribers | A | identical, deterministic registration in every process |
| `outboxWorker`/`jobsWorker` start/stop guards | A | process-local by design, never compared cross-process |
| `MemStorage` | A (dead code) | unreachable from any real bootstrap path; zero runtime effect regardless of process count |
| Immutable Sets/Maps (enums, allowlists, per-call locals) | A | either identical-by-construction across processes or never outlive a single call |

### 3. Session model

`connect-pg-simple`-backed (`core/config/session.ts`), already Postgres, already correct. Verified with a genuine 2-real-OS-process test (`multi-instance.p4.test.ts`), not same-process concurrent calls: login via instance A, `whoami` via instance B recognizes it, logout via instance B, `whoami` via instance A correctly returns 401. **PASS, no fix needed.**

### 4. Rate limiting model

**Before:** `const ipStore = new Map<string, RateLimitInfo>()` at module scope in `security.middleware.ts` — the file's own comment already flagged this ("production systems would use Redis/MemoryCache"). Proven broken via a real 2-process test: 292–296 total successful requests across two instances against a supposed 150/min limit (expected ~150 if truly shared).

**After:** new `rate_limit_counters` table (migration `0023_erp008_rate_limit_counters.sql`), one row per key, updated via a single atomic `INSERT ... ON CONFLICT (key) DO UPDATE` with a `CASE`-based window rollover — concurrent callers (same process or different processes) serialize on the row and never lose an increment. Fails open on a storage error (justified: every other component on this request path — sessions, idempotency — already hard-depends on the same database, so a DB outage already degrades the API elsewhere; refusing all traffic here would turn a storage hiccup into a full outage).

Re-ran the identical 2-process test after the fix: **exactly 150 total** requests succeed across both instances (Instance A: 150/150, Instance B: 0/150 — already at the shared limit). Bypass closed. Unit tests (`rate-limiter-race.p4.test.ts`) additionally confirm 40 concurrent same-key requests never lose an increment, and exactly 150 of 160 concurrent requests succeed with the other 10 correctly rejected.

Login has no separate/stricter throttle — it goes through this same general-purpose limiter (confirmed via grep: no dedicated login-throttling code exists in this codebase). Out of scope for this phase to add one (business/security-policy decision, not a state-sharing defect).

### 5. Job ownership model

`JobsRepository.claimNextJob()` already used `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction — correct on inspection, and now also verified with a genuine 2-real-process test (`multi-instance.p4.test.ts`): two separate OS processes concurrently claiming from a pool of 4 seeded jobs never claim the same job.

`OutboxRepository.getPendingEvents()` did **not** have equivalent protection — SELECT and UPDATE were two separate, unlocked statements. Proven via a forced-interleaving repro (two claimants' SELECT phases both completing before either UPDATE) that both would see and process the same event. Fixed by wrapping the claim in one transaction with `SELECT ... FOR UPDATE SKIP LOCKED`, mirroring `claimNextJob()`'s already-correct pattern. Verified: zero duplicate claims across 20 repeated concurrent-claim rounds (`outbox-claim-race.p4.test.ts`).

### 6. Idempotency model

Design was already correct (DB-backed lock via `idempotencyKeys.key` as primary key), but the concurrency-race path was mishandled: a second concurrent request with the same key correctly fails its lock-INSERT with a Postgres `unique_violation` (23505), but that error fell through to a generic `catch` block which called `next()` unconditionally — letting the race through. Proven before the fix: 2 concurrent requests with the same key both executed the sensitive operation (`executionCounter.count` reached 2).

Fixed by catching 23505 specifically at the lock-insert step and returning 409 (the same response already used for the "still pending" case). Verified (`idempotency-race.p4.test.ts`): the sensitive operation executes exactly once under both a 2-way and a 10-way concurrent burst with the same key; later arrivals correctly receive either a 409 (raced mid-flight) or the *cached* response of the single execution (arrived after it completed) — never a fresh, independently-executed 200.

### 7. Shared lock model

No hand-rolled in-memory mutex/lock flags guarding shared data were found (the two `isRunning` booleans in the workers are process-local start/stop guards, not locks over shared data). The three real concurrency-safety mechanisms in the codebase are all DB-level: `FOR UPDATE SKIP LOCKED` (jobs, now also outbox) and unique-constraint-as-lock (idempotency, now also rate limiting). No advisory locks or Redis needed — Postgres already sufficient for every case found.

### 8. Cache model

Only one cache exists: `FeatureFlagService`'s in-process 60s TTL read-through cache over the `feature_flags` table (source of truth = Postgres, staleness bound = 60s, invalidation = time-based only). Not a source of truth for anything; the two flags it exposes today (`enable_rate_limiting`, `enable_strict_cors`) are defined but never read anywhere in the codebase (dead flags). No cross-instance correctness risk identified — Category B, documented not fixed (no live behavior to fix).

### 9. PM2 multi-instance behavior (real PM2, not just config review)

`pm2` (v7.0.3) is available in this environment, so this was tested against a real PM2 daemon rather than reasoned about from config alone:

| Test | Method | Result |
|---|---|---|
| Cluster mode starts 2 real instances | `pm2 start <worker>.js --name p4probe -i 2` | **PASS** — both online, `wait_ready`/`listen_timeout` honored (no restart loop) |
| Shared port load balancing | `curl /ping` × N | both instances reachable on the same port (Node's cluster module) |
| Zero-downtime reload | `pm2 reload p4probe` while streaming 40 requests | **PASS** — all 40 requests returned 200 throughout the reload |
| One instance stops, other stays healthy | `pm2 stop 0` | **PASS** — instance 1 kept serving `/ping` after instance 0 stopped |

**Anomaly found and documented (not chased further — orthogonal to this phase's scope):** starting via an ecosystem `.cjs` file (`pm2 start pm2-test-ecosystem.cjs`) did not apply the file's `instances`/`exec_mode`/`autorestart` settings in this environment — PM2 silently fell back to fork mode, 1 instance, filename-derived app name, and looped restarting (`autorestart: false` in the file was not honored either). The identical worker script launched via direct CLI flags (`-i 2 --wait-ready ... --no-autorestart`) worked correctly in every respect above. This is worth a real smoke test against the project's actual `ecosystem.config.cjs` (currently `instances: 1`, untested at `instances: 2`+) before ever relying on multi-instance PM2 in production — flagged as a residual risk (§14), not fixed here, since it needs a real build (`dist/server.js`) to test against the actual file rather than a probe script.

### 10. Database connection pool budget

`pool = new Pool({ connectionString })` had no `max` set, silently defaulting to `pg`'s built-in ceiling of 10. Local Postgres reports `max_connections = 100` (`SHOW max_connections`), with 9 already in use by other sessions at time of check.

```text
Total possible connections = pool max × process count × node count
```

Made configurable via `DB_POOL_MAX` (default unchanged at 10) so this can be tuned per-environment without a code change. With the current default of 10 and this project's single-node deployment target, a 2-instance PM2 cluster would use up to 20 connections — comfortably under the local instance's 100-connection ceiling, but this must be re-checked against the actual production Postgres's `max_connections` and any other consumers (migrations, ad-hoc admin connections, connection-pooler overhead) before enabling cluster mode there. Not independently re-verified against production infrastructure — flagged as an operational checklist item, not something this phase can close from a dev sandbox.

### 11. Multi-process test results (real, not mocked)

All of the following spawn genuinely separate OS processes — not concurrent calls within one process, which would share the exact module-level state these tests exist to catch:

| Test | File | Result |
|---|---|---|
| Cross-instance session (login A → recognized on B → logout B → rejected on A) | `multi-instance.p4.test.ts` | PASS |
| Concurrent job claim across 2 real processes, zero duplicates | `multi-instance.p4.test.ts` | PASS |
| Rate limit bypass proof (pre-fix) and closure proof (post-fix) | ad hoc verification scripts (not committed — throwaway, matching this engagement's established practice for one-off proof scripts) | pre-fix: 292–296/300 succeeded; post-fix: 150/300 succeeded |
| Real PM2 cluster: start, reload, partial stop | ad hoc `pm2` CLI session (not committed — PM2 process management isn't unit-testable the same way) | PASS on all 3 scenarios (§9) |
| Outbox claim race (forced interleaving + 20-round repeat) | `outbox-claim-race.p4.test.ts` | PASS |
| Idempotency race (2-way and 10-way concurrent bursts) | `idempotency-race.p4.test.ts` | PASS |
| Rate limiter counter atomicity (40 concurrent increments, 160-request burst) | `rate-limiter-race.p4.test.ts` | PASS |

Full regression after all Phase 4 changes: `npm run check` clean; `lint:architecture` 0 unknown violations (525 modules / 1703 deps, 1 pre-existing known violation unchanged); `test:unit` **77 files / 317 tests** (was 73/309 before this phase — 4 new files, 8 new tests, 0 regressions). Husky pre-commit ran the full gate on every commit.

### 12. Failure scenarios

| Scenario | Behavior / policy |
|---|---|
| Two processes claim a job at the same instant | One wins via `FOR UPDATE SKIP LOCKED`; the other sees an empty eligible set and moves on — no error, no duplicate |
| Two processes claim an outbox event at the same instant | Same, now that it also uses `FOR UPDATE SKIP LOCKED` |
| Two requests race the same idempotency key | First proceeds; second gets 409 if still mid-flight, or the first's cached response if it already completed — never a second independent execution |
| Rate-limit storage (Postgres) unavailable | Fails open (logs the error, calls `next()`) — deliberate: every other component on the same request path already hard-depends on this DB, so failing closed here would just turn a storage hiccup into a harder outage without protecting anything the DB outage doesn't already threaten |
| One PM2 instance stopped/crashed | Other instance(s) keep serving — verified with real PM2 (§9) |
| PM2 reload (rolling restart) | Zero dropped requests — verified with real PM2 under a live 40-request stream (§9) |

Not exercised in this phase (would need a real production-like multi-node setup, not a single dev sandbox): a shared-store (Postgres) outage mid-burst under real multi-node load, and duplicate-callback delivery from an external system arriving at two different nodes simultaneously — both reduce to "does the shared DB-level lock/unique-constraint hold," which is exactly what §5/§6 already prove at the mechanism level; a full node-level chaos exercise is Phase 8's concern (Production Validation), not this phase's.

### 13. Commit SHAs

```text
ea85447 — fix(scale): prevent duplicate background job execution in outbox claim
49eef13 — fix(scale): make idempotency middleware concurrency-safe
3341e55 — fix(scale): configure database pool for multi-process runtime
e6a6125 — test(scale): add multi-instance integration coverage
4cc3567 — fix(scale): move rate limiting to shared store
ac67a8d — test(scale): derive multi-instance test ports from process PID
```

### 14. Remaining risks (documented, not fixed — out of scope for this phase)

- The project's actual `ecosystem.config.cjs` (`instances: 1` today) has never been tested at `instances: 2`+ against the real built app — only a minimal probe script was tested under real PM2 (§9). The probe proved Node/PM2 cluster mechanics work correctly in this environment; it did not prove the *real* app boots correctly under them (migrations-on-every-instance-start behavior, static-file serving, Vite dev-server setup — none of which the probe exercises). Needs a real `npm run build` + `pm2 start ecosystem.config.cjs -i 2` smoke test before production cluster mode is enabled.
- The ecosystem-`.cjs`-file-vs-CLI-flags PM2 parsing anomaly (§9) is unexplained — could be a Windows-specific PM2 v7 quirk, unrelated to the real Linux production host, or could recur there too. Not chased further; flagged for a real-environment check.
- DB connection budget (§10) is computed from this dev sandbox's Postgres (`max_connections=100`); not re-verified against actual production Postgres configuration or other concurrent consumers.
- No dedicated login-throttling exists beyond the general 150/min limiter (§4) — a business/security-policy question, not a state-sharing defect, out of scope here.
- `FeatureFlagService`'s two flags are defined but dead (never read anywhere) — noted, not removed (would be a business-logic-adjacent cleanup, not a scalability fix).
- `MemStorage`/`core/database/storage.ts` remain as confirmed-dead code (§1) — same category of pre-existing dead code already documented on the sibling architecture-audit branch; not deleted here (out of scope, no runtime effect regardless of process count).

### 15. Decision

```text
CLOSED
```

---

## Phase 5 — Database Reliability

### 1. Environment surveyed

| Item | Finding |
|---|---|
| Server | PostgreSQL 18.1 (x86_64-windows) — dev sandbox; production may differ |
| Client tools | Full 18.1 suite at `C:\Program Files\PostgreSQL\18\bin` (`pg_dump`, `pg_restore`, `psql`, `pg_amcheck`) |
| `wal_level` | `replica` (sufficient for archiving/PITR/replication) |
| `archive_mode` | **`off`** — no WAL archiving → **no PITR possible as configured** |
| `data_checksums` | **`on`** — page-level corruption detection active at the storage layer |
| Migrations | 25 on disk (0000–0024) = 25 in journal = 25 in `drizzle.__drizzle_migrations` ledger |
| Backup tooling in repo before this phase | **None** (the app-level `ExportSystemBackup` use case is a JSON data export, not a database backup mechanism, and must not be treated as one) |

### 2. Fresh install (migration replay)

`npm run db:erp002:greenfield-proof` (pre-existing ERP-002 script): creates an empty DB, replays every migration, verifies ledger count against the journal, drops the DB.

Result (re-run after this phase's 0024): **`Ledger rows: 25 / journal: 25 — GREENFIELD PROOF PASS`**. The chain is fully self-sufficient from zero.

### 3. Schema drift — found, fixed, and now continuously checkable

New permanent tool: `scripts/erp008-drift-check.mjs` (**`npm run db:drift-check`**) — replays every migration into a throwaway DB and diffs `pg_dump --schema-only` output against the live database (normalizing only pg_dump's random `\restrict` tokens). Any structural difference exits 1.

First run found **exactly one** drift: the `session` table (+ `session_pkey`, `IDX_session_expire`) existed in every live DB but not in a fresh replay — it was created only at app startup by `connect-pg-simple`'s `createTableIfMissing` (runtime DDL outside the chain).

Fix: migration `0024_erp008_session_table_in_chain.sql` codifies the table (definition matches `connect-pg-simple`'s `table.sql` exactly; `IF NOT EXISTS` on table and index, so it is a no-op on every existing DB, and the app's auto-creation remains as a harmless fallback).

After 0024: **`DRIFT CHECK PASS — live schema is byte-identical to migration replay`**.

### 4. Backup / restore drill

New permanent tool: `scripts/erp008-backup-drill.mjs` (**`npm run db:backup-drill`**) — `pg_dump -Fc` the live DB → verify archive readability (`pg_restore --list`) → restore into a throwaway DB → compare per-table row counts and total constraint/index counts → drop. Any mismatch exits 1. Dump files land in `backups/` (gitignored).

| Run | Result |
|---|---|
| As-is | 64 tables, 593 constraints, 189 indexes — all identical, **PASS** (463 TOC entries readable) |
| After seeding 5,000 synthetic `system_logs` rows (then removed) | all identical, **PASS** — the comparison is exercised by real volume, not empty tables |

### 5. Rollback validation

| Migration | Proof |
|---|---|
| 0021 `number_sequences` unique | **Permanent regression test** (`number-sequences.p21.test.ts` — "supports constraint rollback then re-apply without data loss") runs in every suite |
| 0022 metrics grain unique | **Permanent regression test** (`technician-sales-metrics.p22.test.ts` — "supports constraint rollback then re-apply") runs in every suite |
| 0023 `rate_limit_counters` | Proven on a throwaway fresh-migrated DB: `DROP TABLE` → atomic-increment statement fails exactly as documented → re-apply migration file → increment works again |
| 0024 `session` | Same throwaway DB: `DROP TABLE session` → gone → re-apply → table + index restored |

### 6. Corruption detection

| Check | Result |
|---|---|
| `pg_amcheck --install-missing --heapallindexed` (full DB) | 651 relations, 1,415 pages — **zero corruption findings**, exit 0 |
| `data_checksums` | `on` (continuous page-level detection) |
| `NOT VALID` constraints | 0 — every FK/CHECK is fully validated; orphaned references are impossible while constraints hold |
| Disabled triggers | 0 |

Ops note: `pg_amcheck` should be run periodically (or before major upgrades) in production; it is not wired into the app.

### 7. Startup migration policy — Phase 3 residual risk resolved

Old behavior: any migration failure at boot was swallowed ("continuing assuming schema already applied") — a broken schema could pass readiness and serve traffic. The tolerance existed for the multi-instance boot race (concurrent migrators, spurious loser errors).

Fix (`f59632d`, decision delegated by the user "اختار الأنسب"): a session-level `pg_advisory_lock(823008)` serializes migration across instances — later instances find nothing to apply — so any remaining error is genuine and startup now **fails fast** (exit 1, visible to PM2 immediately).

Proven both ways with real spawned servers:
- Poisoned DB (full schema, drizzle ledger dropped → migrator re-runs 0000 → `relation "item_types" already exists`): **exit 1, "Startup failed"** — exactly the error class the old code swallowed silently.
- Healthy DB: migrations complete, `/health/ready` → `{"status":"UP"}`.

### 8. PITR — capability assessment (honest gap, not fabricated)

Not possible on this sandbox as configured (`archive_mode=off` → no WAL archive to replay). `wal_level=replica` already satisfies the WAL prerequisite. **Production requirements to claim PITR** (must be verified on the production host, not here):

1. `archive_mode = on` + a real `archive_command` (or a tool that manages both — pgBackRest / WAL-G recommended).
2. Periodic `pg_basebackup` (physical base backups) — the logical `pg_dump` drill above is *not* a PITR base.
3. A tested restore-to-timestamp drill on the production/staging host.

### 9. Failover — capability assessment (honest gap)

Single-node PostgreSQL, no standby configured → there is nothing to fail over to and no drill was faked. Production requirements: a streaming replica + documented promotion runbook (or managed-HA Postgres). Until then, RTO after node loss = restore-from-backup time (measured by the drill machinery above).

### 10. Test / gate results

| Gate | Result |
|---|---|
| Entry gate | clean tree @ `87c72d0`; typecheck PASS; architecture PASS; unit suite 76/77 first run with the known multi-instance flake, re-verified green in isolation |
| Multi-instance flake root-caused | worker-ready timeout 15s → 60s (workers cold-compile the app through tsx while the full suite runs; 15s was routinely exceeded under load — it had blocked two commits in a row) |
| Husky pre-commit (full lint + 77/317 suite) | PASS on all three Phase 5 commits |
| Greenfield proof (post-0024) | PASS 25/25 |
| Drift check (post-0024) | PASS (byte-identical) |
| Backup drill | PASS ×2 |

### 11. Commit SHAs

```text
8f9a4b8 — fix(db): eliminate session-table schema drift, add repeatable drift check
b2bb124 — feat(db): add automated backup/restore drill
f59632d — fix(db): serialize startup migrations, fail fast on genuine failure
```

### 12. Remaining risks (documented, not fixed)

- **PITR and failover are documented requirements, not tested capabilities** (§8, §9) — both need the production/staging host. Certification below is scoped accordingly.
- Backup **scheduling, retention, and offsite storage** are ops policy outside the codebase; the drill proves restorability of a taken backup, not that backups are being taken.
- `pg_basebackup` (physical) backups not exercised — only logical `pg_dump`.
- All server-side findings (`data_checksums=on`, `max_connections`, versions) are from the dev sandbox; production Postgres must be re-surveyed against §1's checklist.
- Drizzle journal entries for hand-written migrations (0017–0019, 0021–0024) have no `meta/*_snapshot.json` files — consistent established pattern on this branch; `drizzle-kit generate` diffing is not used, so harmless today, but a future return to generated migrations would need a snapshot rebase.

### 13. Decision

```text
Database Reliability Certified — dev-verifiable scope
(fresh install, drift, backup/restore, rollback, corruption, startup policy: PROVEN
 PITR + failover: documented production preconditions, NOT yet drilled)
Phase 5 CLOSED
```

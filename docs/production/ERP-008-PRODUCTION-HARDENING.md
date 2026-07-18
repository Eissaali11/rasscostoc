# ERP-008 — Production Blockers Elimination Program

| Field | Value |
|---|---|
| **Status** | Phase 1 CLOSED; Phase 2 baseline READY; **P2.1 CLOSED** — P2.2 next |
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
| 2 | Financial Integrity (`number_sequences`, sales metrics ON CONFLICT) | **P2.1 CLOSED — P2.2 next** |
| 3 | Runtime Safety (startup/shutdown/SIGTERM/pool) | Pending |
| 4 | Scalability (rate limit / in-memory / PM2) | Pending |
| 5 | Database Reliability (drift / restore test) | Pending |
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

---

## Phase 2 — Financial Integrity (status)

### Isolation
Clean worktree created; dirty `courier-custody-tech-fix` untouched.

### Baseline
**BASELINE READY** — details in [`docs/production/ERP-008-PHASE-2-BASELINE.md`](ERP-008-PHASE-2-BASELINE.md), [`ERP-008-MIGRATION-UNBLOCKER.md`](ERP-008-MIGRATION-UNBLOCKER.md), [`ERP-008-BASELINE-BLOCKER.md`](ERP-008-BASELINE-BLOCKER.md).

### Static evidence remaining (P2.2)
- `technician_sales_metrics_daily`: `ON CONFLICT (sales_date, technician_id, item_type_id, region_id)` without unique constraint; nullable `region_id`/`item_type_id` → NULL semantics decision required before P2.2 migration.

### P2.2
**Not started** — wait for P2.1 commit + clean tree.

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

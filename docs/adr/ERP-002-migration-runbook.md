# ERP-002 — Migration Deploy & Rollback Runbook

**Status:** Active  
**Date:** 2026-07-14  
**Scope:** Database migrations only (no feature/performance work)  
**Related:** [ERP-002 ADR](./ERP-002-drizzle-migration-drift.md) · [Audit report](./ERP-002-migration-drift-audit.md)

## Goal

Make `npm run db:migrate` **reliable and repeatable** on every environment.

## Roles

| Role | Responsibility |
|------|----------------|
| Deployer (Engineer on-call) | Runs checklist in order; records outcome |
| Reviewer | Confirms audit/catch-up on Staging before Production |
| Owner | Approves Production migrate window |

---

## Pre-flight (every environment)

1. Confirm branch/commit includes `migrations/` + `migrations/meta/_journal.json`.
2. Backup (Production mandatory; Staging recommended):
   - `pg_dump -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump "$DATABASE_URL"`
3. Run **read-only audit**:
   ```bash
   node scripts/erp002-migration-audit.mjs
   ```
4. Open `docs/adr/ERP-002-migration-drift-audit.md` and note:
   - Missing from ledger
   - Schema probe failures
   - Recommended strategy (**one only**)

---

## Strategy selection (ONE per environment)

| Situation | Strategy |
|-----------|----------|
| Schema objects exist; ledger missing rows; probes PASS | **A — Ledger Catch-up** |
| Ledger behind; schema probes FAIL for some tags | **B — Apply missing DDL** (migrate or idempotent repair), then record hashes |
| Disposable non-prod DB | **C — Rebuild** empty DB + full migrate (+ optional data restore) |

**Never mix A+B+C on the same environment in one release.**

---

## Staging deploy

### Path A (drifted but schema complete) — used for local `nulip_inventory`

1. Audit (read-only) — probes must pass.
2. Dry-run catch-up:
   ```bash
   node scripts/erp002-migration-audit.mjs --catch-up-dry-run
   ```
3. Apply catch-up (**ledger only, no DDL**):
   ```bash
   node scripts/erp002-migration-audit.mjs --catch-up
   ```
4. Migrate (must be no-op / exit 0):
   ```bash
   npm run db:migrate
   ```
5. Re-audit — Missing from ledger = 0.
6. Record: date, commit SHA, operator, `db:migrate` exit code.

### Path B (missing schema objects)

1. Audit — note failed probes.
2. Fix only missing DDL (prefer `npm run db:migrate` if ledger is correct for prior tags; otherwise apply specific SQL files with `IF NOT EXISTS` then catch-up those tags).
3. Re-audit + `npm run db:migrate` until exit 0.

### Path C (greenfield Staging)

1. Create empty database.
2. Set `DATABASE_URL` to the empty DB.
3. `npm run db:migrate` from `0000` through journal end — must exit 0.
4. Optional: restore data dump **after** migrate (not before).

---

## Production deploy

1. Change freeze: no concurrent schema edits.
2. Backup with verified restore point.
3. Run audit against Production `DATABASE_URL`.
4. Apply **the same single strategy** used and proven on Staging for this release.
5. `npm run db:migrate` — expect exit 0.
6. Smoke: app starts; `/health/ready`; one Courier list request.
7. Record release note: commit, strategy (A/B/C), migrate output.

### If Production still shows ERP-001 indexes missing

Only after migrate is healthy, indexes from `0018`/`0019` should already be present. If probes fail for those tags, stop and escalate — do **not** invent a second strategy mid-flight.

---

## Failure handling

| Failure | Action |
|---------|--------|
| `relation already exists` during migrate | **Stop.** Schema ahead of ledger → run audit → Path A catch-up → retry migrate. Do not manually drop objects. |
| `db:migrate` fails mid-file | Drizzle runs in a transaction per migration batch — verify DB state; restore from backup if uncertain. |
| Catch-up refused (schema probe failed) | Do **not** force `--catch-up`. Use Path B. |
| App errors after migrate | Rollback app deploy to previous release; DB rollback only via restore (see below). |

---

## Rollback

Migrations in this project are mostly **forward-only DDL** (CREATE/ALTER/INDEX). There is no automatic down migration.

| Scope | Rollback method |
|-------|-----------------|
| App only | Redeploy previous app artifact / PM2 previous release |
| Failed migrate before commit | Transaction abort — usually nothing to undo; confirm with audit |
| Bad migrate committed | **Restore** `pg_dump` backup taken in pre-flight; re-run audit; re-plan |
| Index-only (`0018`/`0019`) | Safe to `DROP INDEX CONCURRENTLY` if needed (document names); prefer forward fix |

**Production DB rollback = restore from backup**, not hand-written inverse SQL, unless Architecture approves a one-off.

---

## New environment bootstrap

1. Empty PostgreSQL database.
2. `DATABASE_URL` pointing at it.
3. `npm run db:migrate`
4. Confirm ledger row count = journal entry count.
5. Seed/bootstrap app data as per existing ops (out of ERP-002 scope).

---

## Operator checklist (copy/paste)

```
[ ] Backup taken
[ ] node scripts/erp002-migration-audit.mjs
[ ] Strategy chosen: A / B / C
[ ] Staging proven with same strategy
[ ] Catch-up or migrate executed
[ ] npm run db:migrate → exit 0
[ ] Re-audit → 0 missing ledger rows
[ ] Health check OK
[ ] Notes filed (date / SHA / operator)
```

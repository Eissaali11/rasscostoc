# Sprint 1.5 — Validation Gate (ERP-001)

**Status:** **Closed** — Architecture Sign-off: **Conditionally Approved** (2026-07-14)  
**Date:** 2026-07-14  
**Decision:** Sprint 1 + 1.5 closed. **Do not start Sprint 2** until [ERP-003 Release Readiness Check](./ERP-003-release-readiness-check.md) passes.  
**Related:** [ERP-001 ADR](./ERP-001-courier-performance-package-a.md) · [ERP-002 Migration Drift](./ERP-002-drizzle-migration-drift.md) · [Raw EXPLAIN log](./ERP-001-sprint-1.5-validation-report.md)

## Sign-off summary

| Item | Outcome |
|------|---------|
| Package A quality | Accepted as new baseline |
| Approval class | **Conditional** (not Fully Approved) |
| Open: prod-scale EXPLAIN / timings | Deferred — does not reopen Sprint 1 |
| Open: Migration Drift | Tracked in **ERP-002** — required before prod deploy |
| Next gate | **ERP-003 Release Readiness Check** |
## Purpose

Prove Package A improvements with numbers — not migration success alone.

## Method

1. Seed **5,000–20,000** synthetic `courier_requests` / `courier_executions` rows.
2. `ANALYZE` tables.
3. `EXPLAIN (ANALYZE, BUFFERS)` for key predicates.
4. Compare JSON payload wide vs List DTO (25-row page).
5. Cleanup seed (`tid LIKE 'TID%'`).

> Note: Connected DB previously had **3** real rows. Synthetic seed is required for planner behavior.

---

## 1) Index usage — EXPLAIN results

| Scenario | Predicate | Plan | Verdict |
|----------|-----------|------|---------|
| Exact TID | `tid = 'TID0000123'` | **Index Scan** (`courier_requests_tid_pattern_idx` / btree) | ✅ Pass |
| First page list | `ORDER BY id DESC LIMIT 25` + join | **Index Scan Backward** PK + **Index Scan** on `request_id` | ✅ Pass |
| Selective prefix | `sn/sim LIKE 'TID0000123%'` inside search subquery | **Bitmap Index Scan** on `*_pattern_idx` (`~>=~` / `~<~`) | ✅ Pass |
| Broad prefix | `tid LIKE 'TID0001%'` (~20% of rows) | **Seq Scan** (planner chooses it) | ⚠️ Expected at high selectivity |
| Selective prefix (20k rows) | `tid LIKE 'TID0000123%'` | **Index Scan** on `tid_pattern_idx` (`~>=~`/`~<~`) | ✅ Pass |
| Legacy leading `%` | `tid LIKE '%000123%'` | **Seq Scan** | ✅ Confirms why Smart Search forbids it |
| Smart Search shape | `=` / `LIKE 'q%'` + `id IN (SELECT…)` | Index / Bitmap paths; **no Seq Scan** on execution side | ✅ Pass |

### Critical finding (addressed in Sprint 1.5)

Default btree indexes alone did **not** make `LIKE 'prefix%'` use an index under all cases.

**Remediation shipped in Sprint 1.5:**

- Migration `0019_erp001_courier_pattern_ops_indexes.sql` (`text_pattern_ops`)
- Smart Search rewritten so execution SN/SIM matching uses **indexed subquery** (`id IN (…)`) instead of a cross-table `OR` Filter that forced Hash Join + Seq Scan

---

## 2) Smart Search predicate audit

Source: `apps/api/src/modules/courier/application/courier-list-query.ts`

| Pattern | Present? |
|---------|----------|
| `=` equality on identifiers | ✅ |
| `LIKE 'q%'` prefix | ✅ |
| Digits normalization | ✅ |
| `LIKE '%q%'` / `ILIKE '%q%'` | ❌ **Absent** (verified by code + EXPLAIN anti-pattern) |

---

## 3) Payload before / after (25 rows)

| Shape | Size |
|-------|------|
| Wide `request.*` + `execution.*` | ~27.8 KB |
| List DTO (projected columns) | ~7.7 KB |
| **Reduction** | **~72%** |

Further reduction possible later with `view=verification|raw` (Raw Data still needs many request fields for inline edit).

---

## 4) Monitoring coverage (Sprint 1.5)

| Layer | Signal |
|-------|--------|
| SQL | `X-SQL-Time-Ms`, metrics `courier_list_sql_ms` |
| API | `X-API-Time-Ms`, metrics `courier_list_api_ms` |
| Network / TTFB | `courier_client_network_ms`, `courier_client_ttfb_ms` |
| React render | `courier_client_render_ms` |
| Browser paint | `courier_client_paint_ms` (FCP) |
| Transfer size | `courier_client_transfer_bytes` |

Endpoint: `POST /api/observability/client-timing`

---

## 5) Migration history drift (blocking for careless deploy)

### Symptom

`npm run db:migrate` fails locally with `relation already exists` (e.g. `bearer_sessions`) because:

- Physical schema is ahead / partially applied
- `drizzle.__drizzle_migrations` only recorded early hashes (≈ through migration 0010)
- Journal now includes through **0019**

### Policy before production deploy

1. **Do not** blindly run full migrate against production until history is reconciled.
2. Prefer applying **only** `0018` + `0019` with `IF NOT EXISTS` (already written that way), then insert matching drizzle hashes **or** document manual apply in the release checklist.
3. Track as tech-debt ticket: *Reconcile drizzle.__drizzle_migrations with journal 0011–0019*.

Indexes for Package A **were applied** on the local DB via direct SQL (`IF NOT EXISTS`) and verified in `pg_indexes`.

---

## 6) Gate decision

| Question | Answer |
|----------|--------|
| Indexes exist? | ✅ |
| Exact search uses Index Scan? | ✅ |
| Prefix can use Bitmap Index Scan (selective)? | ✅ |
| Leading `%` removed from Smart Search? | ✅ |
| Payload reduced materially? | ✅ ~72% on DTO projection |
| Client timing layers present? | ✅ |
| Production-sized DB measured? | ❌ Still pending (does not reopen Sprint 1 under Conditional Approval) |
| Sprint 2 (Storage Provider) authorized? | **No** — next gate is [ERP-003](./ERP-003-release-readiness-check.md) |

### Sign-off recorded

1. Architect: **Conditionally Approved** — Sprint 1 + 1.5 **Closed**.
2. Migration drift: tracked as [ERP-002](./ERP-002-drizzle-migration-drift.md) (required before prod deploy).
3. Next: [ERP-003](./ERP-003-release-readiness-check.md), then [ERP-004 Enterprise Performance Audit](./ERP-004-enterprise-performance-audit.md). Storage/PDF/AI remain deferred.

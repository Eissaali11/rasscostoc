# ADR ERP-001 — Courier Performance Package A

**Status:** Completed — **Conditionally Approved** (Architecture Sign-off 2026-07-14)  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Scope:** Courier · Verification · Raw Data · Installation Verification  

| Gate | Status |
|------|--------|
| Sprint 1 (Package A) | **Closed** |
| Sprint 1.5 (Validation) | **Closed** |
| Fully Approved (prod-scale numbers) | **Open** — blocked on production-sized measurement |
| Sprint 2 (Storage Provider) | **Deferred** — superseded in ordering by [ERP-004](./ERP-004-enterprise-performance-audit.md) after ERP-002/003 |

## Architecture Sign-off (Conditional)

**Classification:** Conditionally Approved — not Fully Approved.

Package A is the **new development baseline** for Courier Data Access. Open items do **not** reopen Sprint 1, but they **block** careless production deploy and Sprint 2:

1. Re-measure on a production-sized dataset (100k+ / real prod) when available.
2. Remediate **Migration Drift** per [ERP-002](./ERP-002-drizzle-migration-drift.md) before any production release that depends on these changes.
3. Pass [Release Readiness Check](./ERP-003-release-readiness-check.md) before expanding scope.
4. **Do not** start PDF / OCR / AI / Drive / Storage Provider / Queue / Redis until the [Enterprise Performance Audit](./ERP-004-enterprise-performance-audit.md) program has ranked system-wide hotspots and the highest-impact Data Access fixes are underway.

### Accepted as done under Package A

- Removed leading-wildcard `LIKE '%…%'` from the primary list/search path
- List DTO payload reduction (~72% on measured 25-row page)
- Smart Search (exact / prefix / normalized digits) + `text_pattern_ops`
- Appropriate btree + pattern indexes
- Performance instrumentation (SQL / API / Network / TTFB / Render / Paint)
- No business-logic / FSM / custody / permission changes

## Context

Performance Audit v1.0 showed that Courier list latency is driven by the **Data Access Layer**, not by domain architecture, FSM, or API surface:

- Secondary indexes missing on `courier_requests` / `courier_executions`
- Search uses `LIKE '%text%'` across seven columns (cannot use B-tree)
- List queries select full `request.*` + `execution.*`
- Every list call runs a joined `COUNT(*)` then a wide `SELECT`
- Connected audit DB had only 3 rows — live timings are not production SLAs; structural defects remain valid

## Decision

1. **Performance Audit v1.0** is the team reference document.
2. **ERP-001 is binding:** no new feature work inside Courier / Verification / Raw Data until Package A is complete.
3. **Package A** is limited to Data Access improvements (no business-logic change):
   1. Database indexes
   2. Smart Search (exact / prefix / normalized — not `LIKE '%…%'` where avoidable)
   3. List DTO (columns required by list UIs only)
   4. COUNT mitigation (avoid unnecessary joins; parallelize count + rows)
   5. Performance monitoring (SQL / API / Render timings)
4. **Explicitly deferred:** Redis, Queue, Google Drive, StorageProvider, Materialized Views, Cursor Pagination, FSM, custody rules, permissions.
5. **Post–Package A gate:** Release Readiness Check (ERP-003) before Sprint 2 — not a direct jump to Storage Provider.

## Consequences

### Positive

- Highest performance gain with lowest stability risk
- Indexes and smarter predicates scale toward millions of rows without rewrite
- Smaller payloads improve TTFB and React render cost
- Metrics make regressions visible before the next feature lands

### Negative / Trade-offs

- Prefix search may miss mid-string matches that `%text%` previously found (accepted for identifier-first UX)
- Without a production-sized DB, post-change SLAs must be re-measured on a large dataset when available

## Post–Package A roadmap

```
ERP-000      Engineering Governance           ← Binding policy
Sprint 1     Package A (ERP-001)              ← Closed — Conditionally Approved
Sprint 1.5   Validation                       ← Closed — Conditionally Approved
ERP-002      Migration Drift                  ← CURRENT (required before prod deploy)
ERP-003      Release Readiness Check          ← NEXT (baselines + regression)
ERP-004      Enterprise Performance Audit     ← Measure only → Map + Backlog
ERP-004A/B…  Ranked fix packages              ← Implementation (after 004)
─── Deferred until performance foundation is solid ───
Later        Storage Provider
Later        Queue
Later        Redis
Later        Dashboard Summary Tables
Later        Cursor Pagination
Later        Object Storage / Google Drive Archive
Later        PDF / OCR / AI enhancements
```

## Success criteria (re-measure after deploy)

| KPI            | Target   |
|----------------|----------|
| API P95        | < 300ms  |
| API P99        | < 700ms  |
| First page     | < 1s     |
| Search         | < 300ms  |
| DB query       | < 100ms  |
| Payload        | < 100KB  |
| React render   | < 16ms   |
| Time to Interactive | < 2s |

## References

- **Governance:** [ERP-000-engineering-governance.md](./ERP-000-engineering-governance.md)
- Hot path: `GET /api/courier/requests` → `DrizzleCourierRepository.listRequests`
- Audit finding: Seq Scan + leading-wildcard `LIKE` + wide row select
- **Sprint 1.5 Validation Gate:** [ERP-001-sprint-1.5-validation-gate.md](./ERP-001-sprint-1.5-validation-gate.md)
- **Migration Drift:** [ERP-002-drizzle-migration-drift.md](./ERP-002-drizzle-migration-drift.md)
- **Release Readiness:** [ERP-003-release-readiness-check.md](./ERP-003-release-readiness-check.md)
- **Enterprise Performance Audit:** [ERP-004-enterprise-performance-audit.md](./ERP-004-enterprise-performance-audit.md)
- Follow-up migrations: `0018` btree indexes, `0019` `text_pattern_ops` indexes

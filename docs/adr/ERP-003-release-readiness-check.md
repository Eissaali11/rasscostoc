# ERP-003 — Release Readiness Check (Quality Gate)

**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Status:** Pending — blocked until ERP-002 is **Fully Complete** on Staging  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Type:** **Quality Gate only** — not a development / performance-improvement project  

**Prerequisite:** [ERP-002](./ERP-002-drizzle-migration-drift.md) Status = **Completed** (Staging signed)  
**Unlocks:** [ERP-004](./ERP-004-enterprise-performance-audit.md) (**diagnosis only** — Map + Backlog; fixes = ERP-004A/B…)  
**Does not unlock:** PDF / OCR / AI / Drive / Storage / Queue / Redis  

## Single question

> **Is the system ready to start ERP-004?**

Not: “How do we make it faster?”  
Not: “Which indexes should we add?”  
Those belong to **ERP-004** and its Performance Backlog.

## In scope (gate only)

| # | Check | Pass means |
|---|--------|------------|
| 1 | Migrations | ERP-002 Completed on Staging; `db:migrate` safe |
| 2 | Regression smoke | Courier Verification / Raw Data / Reports paths work |
| 3 | Observability live | SQL/API headers + client timing metrics record |
| 4 | Baseline snapshot | Staging numbers recorded as reference (not optimization) |

## Out of scope (enforced)

- New search / DTO / index work  
- Enterprise Performance Audit deep dives (→ ERP-004)  
- Storage / Queue / Redis / PDF / AI  
- Business-logic or FSM changes  

## Roadmap

```
ERP-000  Engineering Governance (binding)
ERP-001  Conditionally Approved (Package A)
ERP-002  Conditionally Complete → Staging → Completed
ERP-003  Quality Gate: ready for ERP-004?   ← this doc
ERP-004  Enterprise Performance Map + Backlog (no fixes)
ERP-004A / 004B … Ranked implementation packages
─── Later ───
Storage / Queue / Redis / PDF / AI / Drive
```

## Checklist

### 1) Migrations integrity

- [ ] ERP-002 Status is **Completed** (Staging checklist signed)
- [ ] `npm run db:migrate` exit 0 on Staging
- [ ] Package A indexes present (`0018` / `0019` probes)
- [ ] Production runbook reviewed (no execute required here)

### 2) Regression — Courier / Verification (smoke)

- [ ] First page `GET /api/courier/requests`
- [ ] Search TID / serial / name prefix
- [ ] Status / reason filters
- [ ] Raw Data list + edit save
- [ ] Reports filtered list
- [ ] Export for a known filter
- [ ] Detail / execution save (FSM untouched)

### 3) Observability on Staging

- [ ] `X-SQL-Time-Ms`, `X-API-Time-Ms`
- [ ] Metrics: `courier_list_sql_ms` / `courier_list_api_ms`
- [ ] Client timing: render / network / TTFB / paint

### 4) Official Baseline (snapshot only — do not optimize here)

| Metric | Target (ERP-001) | Staging baseline | Notes |
|--------|------------------|------------------|-------|
| SQL Time (P50 / P95) | DB &lt; 100ms ideal | _TBD_ | |
| API Time (P50 / P95) | P95 &lt; 300ms | _TBD_ | |
| Payload (25 rows) | &lt; 100KB | _TBD_ | |
| React Render | &lt; 16ms ideal | _TBD_ | |
| Browser Paint (FCP) | — | _TBD_ | |
| Search TID | &lt; 300ms | _TBD_ | |

## Exit criteria

| Result | Meaning |
|--------|---------|
| **Pass** | Sections 1–3 checked; section 4 baselines filled → **start ERP-004** |
| **Fail** | Fix gate blockers only; do not open ERP-004 or deferred platforms |

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Engineering | | | Pass / Fail |
| Architecture | | | Pass / Fail |

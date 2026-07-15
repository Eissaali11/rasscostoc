# ERP-003 — Release Readiness Check (Quality Gate)

**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Status:** In Progress — post-deploy operational verification  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Type:** **Quality Gate only** — not a development / performance-improvement project  

**Prerequisite:** [ERP-002](./ERP-002-drizzle-migration-drift.md) Production ledger aligned (`20/20`) + indexes `0018`/`0019` applied (2026-07-14); Staging sign-off still preferred for Full Complete  
**Unlocks:** [ERP-004](./ERP-004-enterprise-performance-audit.md) (**diagnosis only** — Map + Backlog; fixes = ERP-004A/B…)  
**Does not unlock:** PDF / OCR / AI / Drive / Storage / Queue / Redis  
**Does not unfreeze:** ERP-006A until this gate **Pass**  

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

## Official post-deploy operational checklist (Production)

Source of truth for closing the release cycle after `44adf88`.  
Probe helper: `node scripts/erp003-postdeploy-verify.mjs --base-url https://stc1.fun`

| # | Check | Auto / Manual | Status |
|---|--------|---------------|--------|
| 1 | Open Courier Requests | Auto + UI | ✅ Auto (`GET` 200, 25 rows, sql/api 38ms) — ☐ UI confirm |
| 2 | Search TID (Exact) | Auto + UI | ✅ Auto (`q=15805786`, 6ms) — ☐ UI confirm |
| 3 | Search SN/SIM (Prefix/Exact) | Auto + UI | ✅ Auto (prefix `30302198`, 5–6ms) — ☐ UI confirm |
| 4 | Open Raw Data | Manual UI | ☐ |
| 5 | Edit + save a record | Manual UI | ☐ |
| 6 | PDF Review opens (no AI test) | Auto list + Manual UI | ✅ Auto (`GET /api/courier/pdf` 200) — ☐ UI confirm |
| 7 | Observe `X-SQL-Time-Ms` / `X-API-Time-Ms` | Auto | ✅ (`38` / `38` list; `6` / `6` TID) |
| 8 | No critical errors in PM2 logs | Auto | ✅ (last 80 lines, 2026-07-14) |

Auto probe run: `node scripts/erp003-postdeploy-verify.mjs` → **8/8 PASS** (API/PM2).  
**ERP-003 not closed** until rows 4–5 (and UI confirms for 1–3, 6) are checked by an operator.

**Pass rule:** all 8 checked; then complete sections 1–4 below (or explicitly waive Staging-only rows with Architecture note).

## Checklist

### 1) Migrations integrity

- [x] Production: indexes `0018` / `0019` present (probes PASS)
- [x] Production: Drizzle ledger `20/20` aligned; `db:migrate` no-op OK (2026-07-14)
- [ ] Staging checklist signed (preferred for Full Complete of ERP-002)
- [x] Production runbook path executed (B for indexes → A catch-up)

### 2) Regression — Courier / Verification (smoke)

- [x] First page `GET /api/courier/requests` (auto 200)
- [x] Search TID exact (auto)
- [x] Search SN/SIM prefix (auto)
- [ ] Raw Data list + edit save (**manual**)
- [ ] Reports filtered list (optional stretch)
- [x] PDF list API opens (auto; UI Review ☐)
- [ ] Detail / execution save (**manual** via edit-save)

### 3) Observability (Production post-deploy)

- [x] `X-SQL-Time-Ms`, `X-API-Time-Ms` on list/search
- [x] PM2: no critical error/fatal in recent logs
- [ ] Client timing (UI): render / network — optional snapshot for §4

### 4) Official Baseline (snapshot only — do not optimize here)

| Metric | Target (ERP-001) | Prod snapshot (2026-07-14) | Notes |
|--------|------------------|----------------------------|-------|
| SQL Time (list 25) | DB &lt; 100ms ideal | **38ms** | single sample, not P95 |
| API Time (list 25) | P95 &lt; 300ms | **38ms** | single sample |
| SQL / API (TID exact) | &lt; 300ms | **6ms / 6ms** | |
| SQL / API (SN prefix) | — | **5ms / 6ms** | |
| Payload (25 rows) | &lt; 100KB | _TBD_ | |
| React Render | &lt; 16ms ideal | _manual_ | |
| Browser Paint (FCP) | — | _manual_ | |

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

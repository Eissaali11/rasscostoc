# ADR ERP-004 — Enterprise Performance Audit (System-Wide)

**Governed by:** [ERP-000](./ERP-000-engineering-governance.md) — especially §1 No Optimization Without Measurement and §6 Measure→Decide→Implement→Verify  
**Status:** Accepted — Queued after ERP-002 **Completed** + ERP-003 **Pass**  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Prerequisite:** [ERP-002](./ERP-002-drizzle-migration-drift.md) · [ERP-003](./ERP-003-release-readiness-check.md)  
**Type:** **Diagnosis only** — measurement, map, backlog. **No performance fixes inside ERP-004.**

## Context

ERP-001 fixed Courier Data Access under Conditional Approval. Feature platforms (PDF, AI, Drive, Storage, Queue, Redis) stay deferred until performance is understood **system-wide**.

Risk if ERP-004 is poorly scoped: it becomes an open-ended “fix everything” sprint. Architecture requires separating **diagnosis** from **execution**.

Target (post-fix packages, not this ADR): at **300k–1M+** rows, primary screens open in **≤ 1–2 seconds** without rewriting the product.

## Decision

### 1) Measure before fix

ERP-004 is a **full-system measurement program**, not an optimization program.

Every module must follow the same cycle:

```
Module
  → Measure SQL
  → Measure API
  → Measure Payload
  → Measure Render
  → Identify root cause
  → Classify priority
  → Add to Performance Backlog
```

**Forbidden in ERP-004:**

```
Module → start optimizing immediately
```

### 2) Governing principle — No Optimization Without Measurement

> **No performance change is allowed unless a prior measurement proves the problem.**

This applies to ERP-004 **and** to later fix packages (ERP-004A, ERP-004B, …): each fix must reference a backlog card with evidence.

### 3) Performance Map (system-wide)

| Module | SQL | API | Render | Payload | Status |
|--------|-----|-----|--------|---------|--------|
| Courier Verification | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed (re-baseline) |
| Courier Raw Data | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed (re-baseline) |
| Inventory | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Serialized Items | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Custody | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Reports | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Audit / operations log | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Dashboard | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |
| Accounting | ⏳ | ⏳ | ⏳ | ⏳ | Not reviewed |

### 4) Performance Backlog — unified card

Every issue uses the same card (not a free-form task list):

| Field | Example |
|-------|---------|
| Module | Courier |
| Screen | Verification |
| API | `/api/courier/requests` |
| SQL / path | `listRequests` |
| P95 time | 620ms |
| Root cause | Seq Scan on search |
| Impact | High |
| Fix cost | Low |
| Priority | 🔴 |
| Status | Open / Fixed / Verified |
| Evidence | EXPLAIN / headers / payload bytes (link or snippet) |

Priority matrix:

| Priority | Impact | Cost | Action |
|----------|--------|------|--------|
| 🔴 | High | Low | First execution packages |
| 🟡 | High | High | Spike then schedule |
| 🟢 | Low | Low | Batch later |
| ⚪ | Low | High | Defer |

### 5) Exit criteria — when ERP-004 is **Complete**

ERP-004 ends when **all** of the following are true:

1. All primary modules measured (map rows filled — not left ⏳).  
2. Each module has a performance card / baseline.  
3. All identified issues ranked by priority.  
4. Official **Performance Backlog** published.  
5. **Zero performance fixes shipped under ERP-004 itself.**

After Complete: Architecture Review Cycle (**monthly** backlog re-rank) begins per [ERP-000](./ERP-000-engineering-governance.md).

Execution is **out of scope** for ERP-004 and must be opened as separate packages:

- **ERP-004A**, **ERP-004B**, … (one theme or priority band per package)

### 6) Deferred until after ranked fixes justify them

PDF, OCR, AI, Google Drive, Storage Provider, Queue, Redis, Cursor Pagination as “next feature.”

## Roadmap

```
ERP-001 ✅ Courier Data Access (Conditional Approved)
ERP-002 ⏳ Migrations (Conditionally Complete → Staging → Completed)
ERP-003 ⏳ Quality Gate only (ready for ERP-004?)
ERP-004 ⏳ Measure → Performance Map + Backlog   ← diagnosis only
ERP-004A / 004B …  Execute fixes by priority     ← implementation
─── Later ───
Storage / Queue / Redis / PDF / AI / Drive
```

## Consequences

### Positive

- Prevents mixing diagnosis with implementation  
- Decisions are evidence-based  
- Backlog is manageable and auditable  
- Fix packages stay small and reviewable  

### Negative

- No user-visible speed gains **during** ERP-004 itself (by design)  
- Requires Staging/realistic data for trustworthy numbers  

## Out of scope (ERP-004)

Any index/DTO/search/query change, Redis, Queue, Storage, PDF, AI, business-logic/FSM changes.

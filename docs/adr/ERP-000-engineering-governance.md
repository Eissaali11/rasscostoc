# ADR ERP-000 — Engineering Governance

**Status:** Accepted — Binding for all StockPro Enterprise / RASSCO engineering work  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Scope:** All future development, performance work, infrastructure, and architectural changes  
**Child ADRs:** [ERP-001](./ERP-001-courier-performance-package-a.md) · [ERP-002](./ERP-002-drizzle-migration-drift.md) · [ERP-003](./ERP-003-release-readiness-check.md) · [ERP-004](./ERP-004-enterprise-performance-audit.md) · ERP-004A/B… · [ERP-005](./ERP-005-engineering-standards.md) · [ERP-006](./ERP-006-ai-document-extraction-engine.md)  

## Purpose

ERP-000 is the **governing policy** above all other ADRs.  
Child ADRs record **one decision each**. ERP-000 defines the **rules every decision must obey**.

This document is mandatory for new team members and for any proposal that would otherwise become an ad-hoc shortcut (e.g. “add Redis”, “full rewrite”, “move everything to Drive”).

## Core principles

### 1. No Optimization Without Measurement

No performance change without documented measurement that proves the problem (SQL / API / Payload / Render as applicable).

### 2. No Rewrite Without Business Justification

No module or subsystem rewrite without clear **business** and **technical** justification, recorded in an ADR.

### 3. Performance Before Infrastructure

Fix SQL and Data Access first. Redis, Queue, extra services, or new storage platforms are **not** the default first response to slowness.

### 4. Backward Compatibility First

Changes must not break the running system or existing API contracts unless an explicit architectural decision allows a breaking change (versioned / migrated).

### 5. One ADR = One Decision

Each ADR addresses a **single** decision. Split scope rather than expand a live ADR (prevents scope creep).

### 6. Measure → Decide → Implement → Verify

```
Measure
  → Root-cause analysis
  → Architectural decision (ADR)
  → Bounded implementation
  → Re-measure / verify
  → Accept and close
```

Skipping steps is non-compliant unless Architecture explicitly waives a step in writing.

## Institutional work cycle

Any future improvement (performance or otherwise that affects architecture) follows:

```text
قياس
   ↓
تحليل السبب الجذري
   ↓
قرار معماري (ADR)
   ↓
تنفيذ محدود النطاق
   ↓
التحقق بالأرقام / بالاختبارات
   ↓
اعتماد وإغلاق
```

## ADR series (current)

| ADR | Role |
|-----|------|
| **ERP-000** | Engineering Governance (this document) |
| **ERP-001** | Courier Performance Package A |
| **ERP-002** | Migration Integrity |
| **ERP-003** | Release Readiness (Quality Gate) |
| **ERP-004** | Enterprise Performance Audit (diagnosis only) |
| **ERP-004A / 004B / …** | Ranked implementation packages |
| **[ERP-005](./ERP-005-engineering-standards.md)** | Engineering Standards — *how we write code* (Queued) |
| **[ERP-006](./ERP-006-ai-document-extraction-engine.md)** | AI Document Extraction Engine (PDF temporary → JSON → Courier) |

New ADRs continue the series and **must reference ERP-000**. Coding conventions belong in **ERP-005**, not in this document.

## Anti-patterns (rejected by default)

| Proposal | Why rejected under ERP-000 |
|----------|----------------------------|
| “Let’s add Redis; maybe it gets faster.” | Violates §1 and §3 |
| “Rewrite the whole module.” | Violates §2 and §5 |
| “Move everything to Google Drive.” | Violates §3 and §4 without ADR + justification |
| “Optimize while we audit.” | Violates ERP-004 / §6 (diagnosis ≠ implementation) |
| Mixing migrate + features + perf in one change | Violates §5 |
| “Wire Gemini inside Courier FSM.” | Violates ERP-006 (adapter service) and §5 |

## Four-layer operating model

| Layer | Documents | Function |
|-------|-----------|----------|
| **Governance** | ERP-000 | How decisions are made |
| **Execution** | ERP-001 → ERP-004A… | How decisions are delivered |
| **Standards** | ERP-005 (queued) | How code is written |
| **Operations** | Runbooks (ERP-002 / ERP-003) | How the system is migrated, released, verified |

## Architecture Review Cycle

ADRs must not become a static archive. After the Performance Backlog exists (end of ERP-004), Architecture runs a fixed review cadence — **no new ADR required** for the cadence itself.

### Monthly

- Review Performance Backlog  
- Close completed / verified cards  
- Re-rank priorities (🔴🟡🟢⚪)  

### Quarterly

- Review ERP-000 and ERP-005 (when active)  
- Confirm principles still fit the product  
- Decide whether a **new** ADR is warranted  

### Annually

- Full architecture review  
- Governance compliance check  
- Update the technical roadmap  

Review outcomes are recorded briefly in the ADR index notes or a dated entry under `docs/adr/` (e.g. review minutes) — not by inventing an ADR unless a real decision is made.

## Compliance

- Pull requests that change performance-sensitive paths should cite measurement or an open backlog card (ERP-004+).  
- Infrastructure additions (cache, queue, object storage) require a dedicated ADR under ERP-000 principles.  
- ERP-003 remains a **gate**, not a development sprint.  
- ERP-004 remains **measure-only**; fixes ship only as ERP-004A/B…  

## Change control

Amending ERP-000 itself requires Architecture Sign-off.  
Child ADRs may not weaken these principles; they may only specialize them for one decision.

# ADR Index — StockPro Enterprise / RASSCO

Governing policy: **[ERP-000 — Engineering Governance](./ERP-000-engineering-governance.md)**  
Coding handbook (queued): **[ERP-005 — Engineering Standards](./ERP-005-engineering-standards.md)**

| ADR | Title | Status |
|-----|-------|--------|
| [ERP-000](./ERP-000-engineering-governance.md) | Engineering Governance | Accepted (binding) |
| [ERP-001](./ERP-001-courier-performance-package-a.md) | Courier Performance Package A | Completed — Conditionally Approved |
| [ERP-002](./ERP-002-drizzle-migration-drift.md) | Migration Integrity | Conditionally Complete |
| [ERP-003](./ERP-003-release-readiness-check.md) | Release Readiness (Quality Gate) | In Progress — post-deploy ops verify |
| [ERP-004](./ERP-004-enterprise-performance-audit.md) | Enterprise Performance Audit | Accepted — Queued (diagnosis only) |
| ERP-004A / 004B… | Ranked fix packages | Not opened |
| [ERP-005](./ERP-005-engineering-standards.md) | Engineering Standards | Accepted — **Queued** (not active) |
| [ERP-006](./ERP-006-ai-document-extraction-engine.md) | AI Document Intelligence Platform (parent) | **Architecture Complete & Locked** |
| [ERP-006A Freeze Exception](./ERP-006A-freeze-exception.md) | Exceptional unfreeze for isolated 006A work | **Accepted** — Prod rollout still gated by ERP-003 |
| [ERP-006A Spec](./ERP-006A-implementation-specification.md) · [Acceptance](./ERP-006A-acceptance-tests.md) · [Contracts](./ERP-006A-contracts.md) | PR-006A-1 | **Approved** |
| [ERP-006A PR-006A-2](./ERP-006A-pr-006a-2.md) | Isolated core domain + persistence | **Implemented** |
| [ERP-006A PR-006A-3](./ERP-006A-pr-006a-3.md) | Document Processing (+ heuristic grouping) | **Implemented** |
| [ERP-006A PR-006A-4](./ERP-006A-pr-006a-4.md) | Vision Extraction (Gemini adapter, isolated) | **Implemented** |
| [ERP-006A PR-006A-5](./ERP-006A-pr-006a-5.md) | Canonical Device Graph Runtime | **Implemented** |
| [ERP-006A PR-006A-6](./ERP-006A-pr-006a-6.md) | Technician Matching Runtime | **Implemented** |
| [ERP-006A PR-006A-7](./ERP-006A-pr-006a-7.md) | AI Review Workspace UI | **Implemented** — STOP before 006A-8 |
| [ERP-006A-7 UX Gate](./ERP-006A-pr-006a-7-ux-gate.md) | Manual UX acceptance before Business Rules | **Pending** |
| [ERP-006A Courier PDF Primary UX](./ERP-006A-courier-pdf-primary-ux.md) | Daily path = `/courier/pdf`; `/ai-review` internal | **Accepted** |
| [ERP-006A PR-006A-9](./ERP-006A-pr-006a-9.md) | Courier PDF value path Slice 1 | **In Progress — Slice 1 implemented** |
| [ERP-006A Platform / Consumer Model](./ERP-006A-platform-consumer-model.md) | Multi-provider engine; Courier = first consumer | **Accepted clarification** |
| ERP-006A-8…10 | Rules → Courier PDF value path → Provider settings + Pilot | Planned / partial |
| ERP-006B…H | Child delivery ADRs | Deferred / Planned |

Supporting:

- [ERP-000 Architecture Lint Baseline](./ERP-000-architecture-lint-baseline.md) (temporary debt register for `depcruise`)
- [ERP-001 Sprint 1.5 Validation Gate](./ERP-001-sprint-1.5-validation-gate.md)
- [ERP-002 Migration Drift Audit](./ERP-002-migration-drift-audit.md)
- [ERP-002 Migration Runbook](./ERP-002-migration-runbook.md)
- [ERP-006 Preparation Assets (freeze)](./erp006-prep/README.md)

## Official status (Architecture)

```text
ERP-006 Architecture = Locked
PR-006A-1 = Approved ✅
PR-006A-2 = Implemented ✅
PR-006A-3 = Implemented ✅
PR-006A-4 = Implemented ✅
PR-006A-5 = Implemented ✅
PR-006A-6 = Implemented ✅
PR-006A-7 = Implemented ✅
Current Status: STOP
Awaiting Architecture approval before PR-006A-8
```

| ADR | Status |
|-----|--------|
| ERP-000 | ✅ Governing reference |
| ERP-001 | ✅ Closed (Conditionally Approved) |
| ERP-002 | 🟡 Awaiting Staging runbook |
| ERP-003 | 🟡 In Progress (ops verify) |
| ERP-004 | 🟡 Measure only (no fixes) |
| ERP-004A | ⏸️ Not started |
| ERP-005 | 📚 Queued |
| ERP-006 | ✅ Architecture Complete & Locked |
| ERP-006A Freeze | ✅ Lifted (Exception) — [note](./ERP-006A-freeze-exception.md) |
| ERP-006A-1…7 | ✅ Done |
| ERP-006A-8 | ⏸️ Business Rules — awaiting Architecture approval |
| ERP-006A-9…10 | 📋 Consumer Adapter — Courier → Provider settings + Pilot |
| ERP-006A Prod | ❌ Blocked until ERP-003 Pass |
| ERP-006B–H | 📋 Planned |

## Recommended next steps (Architecture)

**Sole current priority (critical path):**

1. **ERP-002 → Staging** (runbook) → Completed  
2. **ERP-003 → Release Readiness** → Pass  
3. **ERP-004 → system-wide measurement**  
4. **ERP-004A** from evidence only  

**Active (exception):** [Freeze Exception](./ERP-006A-freeze-exception.md) → **PR-006A-1** (Specification → Acceptance Tests → Contracts). No live Gemini / no `/courier/pdf/:id` / no `ocr.helper` in that PR.  
**Still required in parallel:** ERP-002 Staging Completed when environment exists; **ERP-003 Pass before any Production AI enablement**.  
**Do not reopen ERP-006 parent architecture.**  
**Prep assets:** `docs/adr/erp006-prep/`

## Three operating layers (current program)

| Layer | ADRs | State |
|-------|------|--------|
| **Governance** | ERP-000 | ✅ |
| **Stability & performance** | ERP-001 ✅ · 002 🟡 · 003 🟡 · 004 🟡 · 004A ⏸️ | Critical path |
| **New capabilities** | ERP-006 ✅ locked · 006A Freeze Lifted (Exception) · Prod AI ❌ until 003 Pass | Parallel |

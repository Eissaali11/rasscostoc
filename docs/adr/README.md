# ADR Index — StockPro Enterprise / RASSCO

Governing policy: **[ERP-000 — Engineering Governance](./ERP-000-engineering-governance.md)**  
Coding handbook (queued): **[ERP-005 — Engineering Standards](./ERP-005-engineering-standards.md)**

| ADR | Title | Status |
|-----|-------|--------|
| [ERP-000](./ERP-000-engineering-governance.md) | Engineering Governance | Accepted (binding) |
| [ERP-001](./ERP-001-courier-performance-package-a.md) | Courier Performance Package A | Completed — Conditionally Approved |
| [ERP-002](./ERP-002-drizzle-migration-drift.md) | Migration Integrity | Conditionally Complete |
| [ERP-003](./ERP-003-release-readiness-check.md) | Release Readiness (Quality Gate) | Pending |
| [ERP-004](./ERP-004-enterprise-performance-audit.md) | Enterprise Performance Audit | Accepted — Queued (diagnosis only) |
| ERP-004A / 004B… | Ranked fix packages | Not opened |
| [ERP-005](./ERP-005-engineering-standards.md) | Engineering Standards | Accepted — **Queued** (not active) |
| [ERP-006](./ERP-006-ai-document-extraction-engine.md) | AI Document Extraction Engine | **Approved & Implementation Ready** — **006A frozen** until ERP-002 Staging + ERP-003 |
| ERP-006A / 006B / … / **006E** | Extraction delivery + **AI Evaluation & Regression** | Deferred (Freeze; 006E after 006D) |

Supporting:

- [ERP-000 Architecture Lint Baseline](./ERP-000-architecture-lint-baseline.md) (temporary debt register for `depcruise`)
- [ERP-001 Sprint 1.5 Validation Gate](./ERP-001-sprint-1.5-validation-gate.md)
- [ERP-002 Migration Drift Audit](./ERP-002-migration-drift-audit.md)
- [ERP-002 Migration Runbook](./ERP-002-migration-runbook.md)

## Official program status (Architecture)

| ADR | Status |
|-----|--------|
| ERP-000 | ✅ Governing reference |
| ERP-001 | ✅ Closed (Conditionally Approved) |
| ERP-002 | 🟡 Awaiting Staging runbook |
| ERP-003 | 🟡 Awaiting quality gate |
| ERP-004 | 🟡 Measure only (no fixes) |
| ERP-004A | ⏸️ Not started |
| ERP-005 | 📚 Queued |
| ERP-006 | ✅ Approved & Implementation Ready |
| ERP-006A–D | ❄️ Frozen |
| ERP-006E | 📋 Planned (after 006D) |

## Recommended next steps (Architecture)

**Sole current priority:**

1. **ERP-002 → Staging** (runbook)  
2. **ERP-003 → Release Readiness**  
3. **ERP-004 → system-wide measurement**  
4. **ERP-004A** from evidence only  

**Frozen / later:** ERP-006A–E (after 002 Staging + 003); ERP-005 when team grows or after 004.

## Three operating layers (current program)

| Layer | ADRs | State |
|-------|------|--------|
| **Governance** | ERP-000 | ✅ |
| **Stability & performance** | ERP-001 ✅ · 002 🟡 · 003 🟡 · 004 🟡 · 004A ⏸️ | Critical path |
| **New capabilities** | ERP-006 ✅ ready · 006A ❄️ frozen · 006E later | Parallel, gated |

# ERP-005A — System-Wide Architecture Audit Report

This report presents the findings of the repository-wide architectural linting audit conducted via `dependency-cruiser` in strict mode. It maps out all current dependency violations, classifies their severity, and details the structural refactoring backlog needed to achieve clean modular boundaries.

---

## 📊 Audit Metadata
* **Execution Timestamp**: 2026-07-15T02:05:00+03:00
* **Audit Tool**: `dependency-cruiser v18.0.0`
* **Scanned Path**: `apps/api/src`
* **Total Modules Cruised**: 485
* **Total Dependencies Cruised**: 1,582
* **Total Architectural Violations Detected**: 21 (21 errors, 0 warnings)

---

## ⚠️ Violations Summary & Severity Classification

| Severity | Count | Violation Type | Description |
| :--- | :--- | :--- | :--- |
| **Critical** | 3 | Domain Leaks | Business entities or domain services importing infrastructure (`drizzle-orm`) or application layers. |
| **High** | 10 | Application Layer Leaks | Use cases or application services importing concrete database repositories or query builders instead of Interfaces/Ports. |
| **Medium** | 4 | Cross-Module Internal Leaks | Modules importing directly from private internal directories of other modules instead of defined public API exports. |
| **Low** | 4 | Test & Guard Violations | Test files importing concrete repositories, or security guards carrying database query-builder dependencies. |

---

## 🗺️ Architectural Mapping & Documentation Index

A comprehensive breakdown of dependencies and the ranked remediation backlog has been compiled into isolated detail reports:

1. **Dependency Graphs**:
   * Detailed module boundaries and layers are mapped in:
     📁 [module-dependency-map.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/module-dependency-map.md)
2. **Layer Boundary Violations**:
   * Deep-dive into domain and application layer leaks:
     📁 [layer-violations.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/layer-violations.md)
3. **Cross-Module Imports**:
   * Tracking private API leaks between modules:
     📁 [cross-module-imports.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/cross-module-imports.md)
4. **Database & Presentation Boundaries**:
   * Mapping direct SQL or Drizzle leakage outside Infrastructure:
     📁 [database-access-map.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/database-access-map.md)
     📁 [frontend-boundary-map.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/frontend-boundary-map.md)
5. **Remediation Plan**:
   * The prioritized backlog and action items:
     📁 [ranked-remediation-backlog.md](file:///d:/nulip-new.worktrees/copilot-worktree-2026-05-21T10-17-55/docs/adr/erp005a-results/ranked-remediation-backlog.md)

---

## 🚦 Phase 1 Audit Conclusion
No runtime code changes have been introduced. The project is verified to have 21 architectural violations.

* **Verdict**: **FAILED ARCHITECTURAL LINT GATES** (21 violations).
* **Action Required**: Approve the remediation roadmap (`ERP-005A-2` through `ERP-005A-9`) to resolve these boundaries.

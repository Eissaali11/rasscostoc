# ADR ERP-005A-3 — Courier Modularization: Port Extraction & Circular Dependency Resolution

**Status:** Phase 1 Complete  
**Date:** 2026-07-15  
**Author:** Antigravity (AI Engineering Agent)  
**Product:** StockPro Enterprise / RASSCO  

---

## Context

Prior to this ADR, the `courier` module had a critical circular dependency in its domain layer:

```
courier/domain/repositories/courier.repository.interface.ts
  → courier/application/courier.service.ts   (for ListFilters)
```

This violated the fundamental principle of Clean Architecture:
> **The Domain layer must never depend on Application or Infrastructure.**

Additionally, `ICourierRepository` was structurally incomplete — missing 15+ operations that `CourierService` was performing by calling `db` (Drizzle) directly, bypassing the repository boundary entirely.

---

## Decisions Made

### 1. Domain Types Extraction
**Created**: `apps/api/src/modules/courier/domain/courier.types.ts`

Moved `ListFilters` and other shared domain contracts out of the Application layer and into the Domain layer. This is the Single Source of Truth for all courier filter/query types.

### 2. ICourierRepository Port Expansion
**Updated**: `apps/api/src/modules/courier/domain/repositories/courier.repository.interface.ts`

- Removed the circular import of `ListFilters` from `courier.service.ts`
- Added **20+ new methods** to cover all data operations:
  - `transaction()` — Unit of Work pattern
  - `deleteRequestItems()`, `bulkUpdateRequestItems()`, `findRequestItemsBySerials()`
  - `getDashboardStats()`, `getAiMonitorStats()`
  - `findPdfReportById()`, `listPdfReports()`, `insertPdfReport()`, `updatePdfReport()`
  - `findItemTypeById()`, `findUserById()`, `findLinkedRequestItemBySerial()`
  - `existsRequestWithTid()`, `insertRequestBulk()`
  - `listAuditLogs()`

### 3. Infrastructure Implementation
**Rewritten**: `apps/api/src/modules/courier/infrastructure/repositories/drizzle-courier.repository.ts`

All new Port methods are implemented here with full Drizzle ORM queries. All Drizzle SQL logic is now encapsulated within the Infrastructure layer — the correct location.

### 4. Circular Dependency: RESOLVED
**Updated**: `courier-list-query.ts`

Changed the import source of `ListFilters` from `application/courier.service.ts` to `domain/courier.types.ts`, eliminating the infra → application dependency violation.

### 5. Tracked Technical Debt
`courier.service.ts` still contains direct `db` and Drizzle imports for complex transactional operations (confirmReceiving, startTask, applyPdfReport, etc.). These are:
- **Documented** inline with a `// ERP-005A-4` comment block
- **Tracked** in `.dependency-cruiser-known-violations.json` as accepted legacy violations
- **Scheduled** for removal in ERP-005A-4 (Inventory/Custody Isolation)

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Circular Dependencies in Domain | 1 | **0** ✅ |
| Total Architecture Violations | 21 | **20** |
| ICourierRepository methods | 16 | **36** |
| Unit Tests Passing | 272/272 | **272/272** ✅ |
| Domain layer Drizzle imports | 0 | **0** ✅ |

---

## Files Changed

| File | Action |
|------|--------|
| `courier/domain/courier.types.ts` | **CREATED** — Domain types SSOT |
| `courier/domain/repositories/courier.repository.interface.ts` | **REWRITTEN** — Full Port definition |
| `courier/infrastructure/repositories/drizzle-courier.repository.ts` | **REWRITTEN** — Full implementation |
| `courier/infrastructure/courier-list-query.ts` | **UPDATED** — Import source fix |
| `courier/application/courier.service.ts` | **UPDATED** — ListFilters re-export + technical debt documentation |
| `.dependency-cruiser-known-violations.json` | **UPDATED** — Removed resolved circular dependency |

---

## What Remains for ERP-005A-4

The 20 remaining violations are distributed as follows:

- **Courier Guards** (`TechnicianGuard.ts`, `CustodyGuard.ts`): Direct Drizzle queries → to be replaced with repository port calls
- **Courier Service** (`courier.service.ts`): Inline Drizzle transactions → to be delegated to repository
- **Inventory Domain** (`custody-engine.ts`): Direct Drizzle dependency in domain layer
- **Inventory Presentation** (`routes`): Direct Drizzle/UoW dependencies in routes
- **Cross-Module Imports**: Remaining direct imports between courier/inventory internals

---

## Exit Criteria for Full ERP-005A-3 Completion

- [ ] `courier.service.ts` has zero `drizzle-orm` imports
- [ ] `TechnicianGuard.ts` and `CustodyGuard.ts` use repository ports only
- [ ] All database operations pass through `ICourierRepository` exclusively

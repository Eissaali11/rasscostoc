# ERP-005A — Ranked Remediation Backlog

This backlog lists and prioritizes the remediation tasks required to resolve all 21 dependency-cruiser violations in `apps/api/src`.

---

## 📈 Backlog Prioritization Matrix

| Phase | Package | Target File(s) | Remediation Plan | Est. Effort |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **ERP-005A-2: Core Boundary Enforcement** | `core/jobs` | Verify zero direct business module references (already verified: PASS). Ensure strict boundary lints are configured. | Low |
| **Phase 2** | **ERP-005A-3: Courier Modularization** | `courier/domain/`, `courier/application/`, `courier.service.ts` | 1. Define `CourierRepositoryPort` interface in Domain.<br>2. Make `DrizzleCourierRepository` implement the port in Infrastructure.<br>3. Remove Drizzle imports from application and domain services.<br>4. Inject Repository port in Service constructor. | Medium |
| **Phase 3** | **ERP-005A-4: Inventory/Custody Isolation** | `inventory/domain/custody-engine.ts`, `warehouse-transfer-operations.routes.ts`, `serialized-items.routes.ts` | 1. Remove `drizzle-orm` imports from `custody-engine.ts`. Refactor queries into `InventoryRepositoryPort`.<br>2. Remove `DrizzleInventoryUnitOfWork` and Drizzle imports from routes. Restructure controllers to call use-cases. | High |
| **Phase 4** | **ERP-005A-5: Cross-Module Boundary Fixes** | `inventory.subscriber.ts`, `SerializedItemsAdapter.ts`, `courier-pdf-extraction.adapter.ts` | 1. Refactor `inventory.subscriber.ts` to only import from the public Courier interface/contracts.<br>2. Extract shared settings queries to a clean settings port instead of deep imports. | Medium |
| **Phase 5** | **ERP-005A-6: Frontend Feature Boundaries** | `apps/portal` | 1. Implement Feature-First structure.<br>2. Isolate API clients under `shared/api/`. | High |
| **Phase 6** | **ERP-005A-7: Shared Contracts Split** | `packages/shared-types` | Split shared-types into `shared-contracts`, `shared-validation`, and `shared-kernel` to prevent circular dependencies. | Medium |
| **Phase 7** | **ERP-005A-8: SSOT Configuration** | `config.service.ts` | Centralize environment parsing. | Low |
| **Phase 8** | **ERP-005A-9: Full Revalidation** | Whole workspace | Run strict depcruise verification and check types. | Low |

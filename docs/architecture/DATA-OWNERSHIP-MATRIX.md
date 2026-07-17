# ERP-005A-4 Phase 0.5 — Full Data Ownership Matrix

## Status update — post Phase 3 / 4 / 4B

The scan and matrix below (dated 2026-07-17, the original Phase 0.5 baseline) are left unedited as the historical record of what was found before any fix landed. This section tracks what has actually been fixed since, so the "13 violations" figure below is not mistaken for the current state.

| ID | Table(s) | Direction | Status | Fixed in |
|---|---|---|---|---|
| V1 | `items` | courier → inventory | **Fixed** — courier now reads via `ICourierInventoryPort` / `CourierInventoryPortAdapter`, no direct table import | Phase 3 |
| V1b | `item_types`, `inventory_transactions`, `item_history_logs` | courier → inventory | **Fixed** — same port as V1 covers these | Phase 3 |
| V2 | `users` | inventory → identity | **Fixed** — all 19 files (18 originally found + `ExportSystemBackup.use-case.ts` found during final verification) now read via `IdentityUserReadPort` / `TechnicianEligibilityPort` / `IdentityStatsPort` / `IdentityUserRestorePort`, backed by `IdentityPortsAdapter`, wired in `composition/inventory-identity.adapter.ts` | Phase 4 |
| V2b | `technicians_inventory`, `technician_fixed_inventories`, `technician_fixed_inventory_entries`, `technician_moving_inventory_entries`, `inventory_requests` | identity → inventory | **Fixed** — `DrizzleAdminDashboardRepository.ts` and `DrizzleSupervisorUsersReadRepository.ts` now read via `InventoryTechnicianDataPort`, backed by `InventoryTechnicianDataService` (inventory-owned), wired in the same `composition/inventory-identity.adapter.ts` | Phase 4B |
| V2c | `supervisor_technicians`, `supervisor_warehouses` | (was: identity file, inventory tables) | **Fixed by relocation** — `SupervisorRepository.ts` (identity) was git-renamed to `apps/api/src/modules/inventory/infrastructure/database/SupervisorAssignmentsRepository.ts`; these tables are now read in-module by their rightful owner. The one remaining cross-module edge (its `getSupervisorTechnicians` method needs identity's `users` row data for a legacy contract that still returns `UserSafe[]`) is now served by a new narrow `SupervisorTechnicianDisplayPort`, part of the same `IdentityPortsAdapter` used for V2 | Phase 4B |
| V2c (`courier_request_items`) | `courier_request_items` | (was: inventory file, courier table) | **Fixed by relocation (discovered stale during Phase 5B; the fix itself predates Phase 3)** — the one file that read this table, `modules/inventory/infrastructure/subscribers/inventory.subscriber.ts`, was git-renamed to `modules/courier/infrastructure/subscribers/inventory-deduction.subscriber.ts` by the Phase 1/2 cycle-breaking commit `71e78ef` (2026-07-17 08:34:50) — 30 minutes after the Phase-0.5 baseline scan below recorded the violation, and before Phase 3 started. Once relocated, the table is read in-module by its rightful owner (courier); its one remaining touchpoint into inventory functionality already goes through the pre-existing `CourierInventoryPortAdapter`/`ICourierInventoryPort` (Phase 3). A Phase 5B re-scan (multi-pattern: Drizzle imports, raw SQL literals, every courier-owned table name) confirmed zero references to any courier-owned table remain anywhere under `modules/inventory/**` today. This row was left showing "Pending" after the Phase 5 update purely because the matrix was never revisited to reflect the Phase-1/2-era fix — Phase 5B's contribution is this correction, not a code change | Phase 2 (C1 fix); documentation corrected in Phase 5B |
| V3 | `users`, `item_types` (raw SQL) | accounting → identity/inventory | **Fixed** — all 8 raw-SQL usages across 6 methods in `accounting.service.ts` now read via `AccountingIdentityLookupPort` (technician display name + region) and `AccountingCatalogLookupPort` (item type display name), backed by identity's existing `IUserRepository` and a new neutral `IItemTypeCatalogRepository` (`@stockpro/contracts`) implemented by inventory's `ItemTypesService`, wired in `composition/accounting-cross-module.adapter.ts` | Phase 5 |
| C1-C4 | (dependency cycles) | — | C1, C2, C4 fixed (Phase 1-3); C3 (`core/telemetry/tracer.ts` ↔ `metrics.ts`) is pre-existing and explicitly out of scope until Phase 6 | Phase 1-3 (partial) |

As of Phase 5B: zero direct imports of inventory-owned tables remain anywhere under `apps/api/src/modules/identity/**`, zero direct imports of `users`/`items`/`item_types`/`inventory_transactions`/`item_history_logs`/`courier_request_items`/any other courier-owned table remain under `apps/api/src/modules/{inventory,courier}/**` for the identity/courier↔inventory boundary, and zero raw-SQL references to `users`/`item_types` remain under `apps/api/src/modules/accounting/**` (verified via a raw-SQL-string scan, since this module uses `pool.query`/`client.query` rather than Drizzle imports — no `import { users } from "@shared/schema"` line ever existed there to scan for). Two Phase-5 pre-existing, out-of-scope production defects were discovered and documented (not fixed, per the "no schema changes without separate approval" rule) in `docs/architecture/PHASE-5-ACCOUNTING-CROSS-MODULE-ACCESS.md`: `number_sequences` lacks a unique constraint on `(scope, year)` (blocks `createSalesInvoice`/`postSalesInvoice` end-to-end), and `technician_sales_metrics_daily` lacks a unique constraint matching its own `ON CONFLICT (sales_date, technician_id, item_type_id, region_id)` clause (blocks that specific INSERT unconditionally, independent of either defect).

Remaining known violation after Phase 5B: only the C3 telemetry cycle (`tracer.ts` ↔ `metrics.ts`) — planned for Phase 6. All table-level data-ownership violations originally catalogued in the Phase 0.5 scan are now resolved.

---

Date: 2026-07-17
Method: every one of the 61 tables defined in `packages/shared-types/schemas/*.schema.ts` was checked against every `.ts` file (excluding tests) in `apps/api/src/modules/{accounting,ai-engine-settings,courier,identity,inventory}` for a real `import { ...tableVar... } from ".../schema"` statement — a full file-by-file scan, not a spot-check on a handful of pre-selected tables.

## ⚠️ This scan found materially more cross-module coupling than ARCH-AUDIT-001 reported

ARCH-AUDIT-001 (and, by extension, this plan's original "7 confirmed issues") was based on spot-checking a handful of tables the auditor guessed were likely shared (`items`, `users`, `transactions`, `warehouses`). This Phase 0.5 scan checks **all 61 tables against all module files**, and the picture is bigger:

- **`items`**: not just `SerializedItemsAdapter.ts` (as ARCH-AUDIT-001 stated) — **`courier/infrastructure/repositories/drizzle-courier.repository.ts` also imports it directly**, alongside 4 other tables it has no business touching. See below.
- **`users`**: not 5 inventory files as previously reported — **18 inventory files** plus 1 courier file directly import `users`.
- **6 additional tables** with real cross-module imports that ARCH-AUDIT-001 never checked at all: `item_types` (courier), `courier_request_items` (inventory), `technicians_inventory`/`technician_fixed_inventories`/`technician_fixed_inventory_entries`/`technician_moving_inventory_entries`/`inventory_requests`/`supervisor_technicians`/`supervisor_warehouses` (all read by **identity**, going the opposite direction from the V1-V3 findings — identity reaching into inventory, not just inventory reaching into identity), and `inventory_transactions`/`item_history_logs` (courier).

**Total confirmed data-ownership violations: 13 tables** (up from the 3 tables — `items`, `users`, `item_types` via accounting SQL — in the original scope), across **7 distinct violating files**, not the 6 files (5 inventory + 1 accounting) originally documented.

### The single biggest correction: `drizzle-courier.repository.ts`

```typescript
import {
  courierRequests, courierExecutions, courierCities, courierSimTypes,
  courierVendorTypes, courierFailureReasons, courierAuditLogs, courierPdfReports,
  users,                    // ← identity's table
  courierRequestItems, courierExecutionAttempts,
  itemTypes, items, inventoryTransactions, itemHistoryLogs,   // ← 4 of inventory's tables
} from "@shared/schema";
```

This is courier's **main repository implementation** (877 lines, implements `ICourierRepository`, `ICourierRequestsRepository`, `ICourierExecutionsRepository`, `ICourierPdfRepository`, `ICourierDashboardReadRepository`, `ICourierInventoryPort`) — not a small edge-case adapter. It directly imports and presumably queries/joins against 5 tables it does not own. This makes Phase 3's real scope (removing courier's direct access to `items`) substantially larger than "rewrite one adapter file" — it also touches this central repository, and by extension `itemTypes`/`inventoryTransactions`/`itemHistoryLogs`, which were not previously in scope at all.

### The new, opposite-direction finding: identity reads inventory's technician-stock tables

Two identity repository files — `DrizzleAdminDashboardRepository.ts` and `DrizzleSupervisorUsersReadRepository.ts` — directly import `technicians_inventory`, `technician_fixed_inventories`, `technician_fixed_inventory_entries`, `technician_moving_inventory_entries`, and `inventory_requests` (all inventory-owned), plus `SupervisorRepository.ts` imports `supervisor_technicians`/`supervisor_warehouses` (arguably identity's own tables by name, but worth confirming ownership — see note below). This is architecturally understandable — an admin/supervisor dashboard needs cross-domain data — but it is real coupling in the opposite direction from V1-V3, and was not in the original 6/7-issue scope at all.

## Full matrix (all 61 tables)

`core_jobs`, `idempotency_keys`, `outbox_events`, `system_logs` are owned by `apps/api/src/core/**`, which is explicitly exempt from module-ownership rules per this plan's own §1.4 — cross-module reads of these are by design, not violations.

| table_name | owning_module | consuming_modules (files) | access_type | legacy_violation? |
|---|---|---|---|---|
| `chart_of_accounts` | accounting | — | direct import | no |
| `journal_entries` | accounting | — | direct import | no |
| `journal_entry_lines` | accounting | — | direct import | no |
| `customers` | accounting | — | direct import | no |
| `suppliers` | accounting | — | direct import | no |
| `sales_invoices` | accounting | — | direct import | no |
| `sales_invoice_lines` | accounting | — | direct import | no |
| `technician_sales_metrics_daily` | accounting | — | direct import | no |
| `purchase_bills` | accounting | — | direct import | no |
| `purchase_bill_lines` | accounting | — | direct import | no |
| `payments` | accounting | — | direct import | no |
| `payment_allocations` | accounting | — | direct import | no |
| `tax_codes` | accounting | — | direct import | no |
| `tax_transactions` | accounting | — | direct import | no |
| `einvoice_documents` | accounting | — | direct import | no |
| `number_sequences` | accounting | — | direct import | no (see production defect noted in ACCOUNTING-CROSS-MODULE-SQL-AUDIT.md) |
| `refresh_tokens` | identity | — | direct import | no |
| `bearer_sessions` | identity | — | direct import | no |
| `regions` | inventory | — | direct import | no |
| `item_types` | inventory | courier (1) | direct import | **YES — new finding** |
| `courier_cities` | courier | — | direct import | no |
| `courier_sim_types` | courier | — | direct import | no |
| `courier_vendor_types` | courier | — | direct import | no |
| `courier_failure_reasons` | courier | — | direct import | no |
| `courier_requests` | courier | — | direct import | no |
| `courier_request_items` | courier | inventory (1) | direct import | **YES — new finding** |
| `courier_executions` | courier | — | direct import | no |
| `courier_pdf_reports` | courier | — | direct import | no |
| `courier_audit_logs` | courier | — | direct import | no |
| `outbox_events` | core | — | direct import | exempt (core) |
| `idempotency_records` | courier | — | direct import | no |
| `courier_execution_attempts` | courier | — | direct import | no |
| `inventory_items` | inventory | — | direct import | no |
| `technicians_inventory` | inventory | identity (1) | direct import | **YES — new finding** |
| `transactions` | inventory | — | direct import | no |
| `withdrawn_devices` | inventory | — | direct import | no |
| `received_devices` | inventory | — | direct import | no |
| `technician_fixed_inventories` | inventory | identity (2) | direct import | **YES — new finding** |
| `stock_movements` | inventory | — | direct import | no |
| `technician_fixed_inventory_entries` | inventory | identity (1) | direct import | **YES — new finding** |
| `technician_moving_inventory_entries` | inventory | identity (1) | direct import | **YES — new finding** |
| `products` | inventory | — | direct import | no |
| `sales_orders` | inventory | — | direct import | no |
| `sales_order_items` | inventory | — | direct import | no |
| `product_transfers` | inventory | — | direct import | no |
| `technician_product_stock` | inventory | — | direct import | no |
| `users` | identity | courier (1), inventory (18) | direct import | **YES — V2, larger than reported (18 not 5 files)** |
| `warehouses` | inventory | — | direct import | no |
| `supervisor_technicians` | identity | inventory (2) | direct import | **YES — new finding** |
| `supervisor_warehouses` | identity | inventory (5) | direct import | **YES — new finding** |
| `warehouse_inventory` | inventory | — | direct import | no |
| `warehouse_inventory_entries` | inventory | — | direct import | no |
| `inventory_requests` | inventory | identity (1) | direct import | **YES — new finding** |
| `warehouse_transfers` | inventory | — | direct import | no |
| `items` | inventory | courier (2) | direct import | **YES — V1, larger than reported (2 files not 1)** |
| `inventory_transactions` | inventory | courier (1) | direct import | **YES — new finding** |
| `item_history_logs` | inventory | courier (1) | direct import | **YES — new finding** |
| `custody_movements` | inventory | — | direct import | no |
| `system_logs` | core | identity (1), inventory (3) | direct import | exempt (core) |
| `idempotency_keys` | core | — | direct import | exempt (core) |
| `core_jobs` | core | — | direct import | exempt (core) |

`access_contract` and `migration_status` columns (per the plan's requested schema) are intentionally omitted from the table above: no ports/contracts exist yet for any of the 13 violations (all are `"direct"` / `migration_status: pending`), so a column that would read "direct / pending" 61 times added no information — this note records that fact once instead.

## Revised issue count

| ID | Table(s) | Violating module → owning module | File(s) | Was in original scope? |
|---|---|---|---|---|
| V1 | `items` | courier → inventory | `SerializedItemsAdapter.ts`, **`drizzle-courier.repository.ts`** | Partially (1 of 2 files known) |
| V1b | `item_types`, `inventory_transactions`, `item_history_logs` | courier → inventory | `drizzle-courier.repository.ts` (same file as V1) | **No — new** |
| V2 | `users` | inventory → identity | 18 files (was reported as 5) | Partially (undercounted) |
| V2b | `technicians_inventory`, `technician_fixed_inventories`, `technician_fixed_inventory_entries`, `technician_moving_inventory_entries`, `inventory_requests` | identity → inventory | `DrizzleAdminDashboardRepository.ts`, `DrizzleSupervisorUsersReadRepository.ts` | **No — new, opposite direction** |
| V2c | `supervisor_technicians`, `supervisor_warehouses`, `courier_request_items` | inventory → identity/courier | `SupervisorRepository.ts` (identity), one inventory file | **No — new** |
| V3 | `users`, `item_types` (raw SQL) | accounting → identity/inventory | `accounting.service.ts` | Yes |
| C1-C4 | (dependency cycles, not tables) | — | see ARCH-AUDIT-001 §4 and ERP-005A-4-BASELINE-RESULTS.md | Yes |

## Phase 0.5 gate status

```
DATA-OWNERSHIP-MATRIX.md covers all 61 tables = YES
```

# ERP-005A-4 Phase 0.4 — Accounting Cross-Module SQL Audit

Date: 2026-07-17
File audited: `apps/api/src/modules/accounting/infrastructure/accounting.service.ts` (1671 lines, the largest file in the codebase, zero pre-existing tests before this audit)
Method: every `FROM`/`JOIN` reference to `users` (owned by `identity`) or `item_types` (owned by `inventory`) was located, mapped to its enclosing method, and locked in with a real-database characterization test in `accounting.service.characterization.test.ts` (7/7 passing).

## 🚫 Pre-existing defect found while building fixtures (not caused by, and out of scope for, ERP-005A-4)

`nextSequence()` (line 180) generates invoice/bill numbers via:
```sql
INSERT INTO number_sequences (scope, year, prefix, next_number)
VALUES ($1, $2, $3, 2)
ON CONFLICT (scope, year)
DO UPDATE SET next_number = number_sequences.next_number + 1, updated_at = NOW()
```
`ON CONFLICT (scope, year)` requires a unique constraint or index on `(scope, year)`. Neither the Drizzle schema (`packages/shared-types/schemas/accounting.schema.ts:274-282`, primary key on `id` only) nor **production** (`\d number_sequences` on `stc1.fun`, confirmed via SSH) has one. **Production has zero rows in `sales_invoices`, `purchase_bills`, and `number_sequences`** — meaning `createSalesInvoice()` and `createPurchaseBill()` have, in all likelihood, never successfully completed in production; every attempt would throw `there is no unique or exclusion constraint matching the ON CONFLICT specification` (reproduced locally while building this audit's fixtures). This affects every method that calls `nextSequence()`: `createSalesInvoice`, `postSalesInvoice` (indirectly, via the invoice it operates on), `createPurchaseBill`, and likely `createReceipt`/`createDisbursement` if they also number documents.

This is **not** a data-ownership or dependency-cycle issue (out of ERP-005A-4's scope) and was **not fixed** here per the "no schema changes, no business-behavior changes" rule. It is flagged prominently because: (a) it blocked the originally-planned characterization approach of exercising `createSalesInvoice`/`postSalesInvoice` end-to-end (fixtures were seeded via direct SQL insert instead — see the test file's header comment), and (b) it is a more urgent, independent production defect that whoever owns `accounting` should be made aware of separately.

## Catalogue of cross-module SQL usages

| # | Method | Line(s) | Table(s) referenced | Purpose | Display or calculation? | Affects accounting entry? | Transactional? | Pagination/sorting? |
|---|---|---|---|---|---|---|---|---|
| 1 | `listSalesInvoices` | 442 | `item_types` | Line-level item display name in invoice list | Display | No | No (single SELECT) | No explicit sort; no pagination |
| 2 | `getSalesInvoice` | 470–471 | `item_types`, `users` | Item + technician display name for one invoice's lines | Display | No | No | N/A (single row + its lines) |
| 3 | `postSalesInvoice` | 696 | `users` | **Writes** `users.region_id` into `technician_sales_metrics_daily.region_id` at posting time | **Calculation / persisted snapshot** (not just display) | Indirectly — feeds a reporting/metrics table, not the journal entry itself | Yes — inside the invoice-posting DB transaction (`BEGIN`/`COMMIT`) | N/A |
| 4 | `listPurchaseBills` | 888 | `item_types` | Line-level item display name in bill list | Display | No | No | No explicit sort; no pagination |
| 5 | `getPurchaseBill` | 914 | `item_types` | Item display name for one bill's lines | Display | No | No | N/A |
| 6 | `getTechniciansPerformance` | 1565–1566 | `users`, `item_types` | Technician name + region (from `users`), item name (from `item_types`), grouped sales metrics | Display + grouping key (`GROUP BY ... u.region_id`) | No (read-only report) | No | No explicit sort beyond `ORDER BY "soldAmount" DESC`; no pagination (caller does in-memory slicing in `getTopTechnicians`) |
| 7 | `getTopTechnicians` | — | (none directly; wraps #6) | Ranks output of `getTechniciansPerformance` | Display | No | No | In-memory `slice(0, limit)` |
| 8 | `getTopItems` | 1658–1659 | `users`, `item_types` | `users.region_id` used as a **filter** (`u.region_id = $n`), `item_types.name_ar` for display | Filter (calculation-adjacent) + Display | No (read-only report) | No | `ORDER BY "soldQty" DESC, "soldAmount" DESC`; `LIMIT` only (no offset/pagination) |

## Field-naming inconsistency discovered (relevant to Phase 5's refactor)

Two different aliasing conventions are used for the *same* logical joined fields across these methods — this must be preserved exactly by any Phase 5 port/adapter, or every frontend consumer of these endpoints breaks silently:

- `getSalesInvoice` / `getPurchaseBill` (raw, unquoted SQL aliases): `item_name_ar`, `technician_name` — snake_case, exactly as written in the SQL, since `pg` does not camelCase unquoted-then-lowercased identifiers.
- `getTechniciansPerformance` / `getTopItems` (double-quoted SQL aliases): `"itemTypeName"`, `"technicianName"`, `"regionId"`, `"soldQty"`, `"soldAmount"` — camelCase, preserved verbatim by the quotes.

## Characterization tests

`apps/api/src/modules/accounting/infrastructure/accounting.service.characterization.test.ts` — **7/7 passing** against a real local Postgres instance, covering all 8 catalogued usages above:

1. `listSalesInvoices` includes the seeded invoice.
2. `getSalesInvoice` returns `item_name_ar` and `technician_name` correctly joined.
3. `getSalesInvoice` tolerates a line with **no technician** (`LEFT JOIN` → `null`, not an error) — deleted/missing-user edge case.
4. `listPurchaseBills`/`getPurchaseBill` return `item_name_ar` correctly joined.
5. `getTechniciansPerformance` returns `technicianName`/`regionId` sourced from `users`, with correct aggregate `soldQty`/`soldAmount`.
6. `getTopTechnicians` correctly ranks using the same `users`-sourced fields.
7. `getTopItems` correctly filters by region (via `users.region_id`) and technician, and excludes rows from a different region — confirms the filter semantics that must be replicated by `InventoryCatalogPort`/`AccountingIdentityPort` in Phase 5.

Not covered (blocked by the `number_sequences` defect above, and not required for Phase 5's read-path scope): `createSalesInvoice`, `postSalesInvoice`'s journal-entry side, `createPurchaseBill` end-to-end through the service's own numbering path.

## Phase 0.4 gate status

```
Accounting SQL audit complete (every function catalogued)       = YES (8/8 usages across 6 distinct methods + 1 wrapper)
Characterization tests written and passing                       = YES (7/7)
Accounting totals snapshot saved                                  = N/A — no pre-existing production totals exist to snapshot
                                                                       (sales_invoices/purchase_bills are empty in production;
                                                                       see the number_sequences defect above)
```

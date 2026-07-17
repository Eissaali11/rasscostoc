# ERP-005A-4 Phase 5 — Accounting Cross-Module Access Audit

Date: 2026-07-17
File audited: `apps/api/src/modules/accounting/infrastructure/accounting.service.ts` (1671 lines). All 8 usages confirmed against the current file this session (direct reads, not secondhand) — identical to the Phase 0.4 audit (`ACCOUNTING-CROSS-MODULE-SQL-AUDIT.md`), confirming zero drift since then.

**Method note:** unlike every other module in this refactor, `accounting.service.ts` contains **zero Drizzle schema imports** — all database access is raw SQL via `pool`/`client.query` from `@core/config/db`. There is no `import { users } from "@shared/schema"` line to grep for; the only way to detect these usages (or a regression reintroducing them) is a raw-SQL-string scan for `FROM users`, `JOIN users`, `FROM item_types`, `JOIN item_types`, etc.

`accountingService` is an eager module-level singleton: `export const accountingService = new AccountingService();` (line 1671) — same eager-instantiation constraint that required the late-binding registry pattern in Phases 4/4B applies here too.

---

## Usage #1 — `listSalesInvoices`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `listSalesInvoices()` |
| Line(s) | 433–448 |
| SQL operation | `SELECT` with `LEFT JOIN LATERAL` subquery |
| External table | `item_types` (inventory-owned) |
| Fields consumed | `item_types.name_ar` — used positionally inside `string_agg(COALESCE(NULLIF(TRIM(sil.description),''), it.name_ar, 'بند'), ' \| ' ORDER BY sil.id)`, only as a 2nd-priority fallback when a line has no free-text description |
| Display-only? | Yes |
| Filtering? | No |
| Sorting? | Invoice list ordered by `si.issue_datetime DESC` (accounting-owned column, unaffected); line order inside the aggregate is `ORDER BY sil.id` (accounting-owned) |
| Calculation? | No |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No (single `pool.query`, no explicit transaction) |
| Pagination? | No explicit pagination (full result set) |
| Current query count | 1 |
| Replacement contract | `AccountingCatalogLookupPort.getItemTypeNamesByIds` — item names resolved in JS after the query returns raw line data (description + item_type_id) per invoice |

## Usage #2 — `getSalesInvoice`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `getSalesInvoice(id)` |
| Line(s) | 450–481 (lines query: 465–475) |
| SQL operation | `SELECT` with plain `LEFT JOIN` (×2) |
| External table | `item_types` (inventory), `users` (identity) |
| Fields consumed | `item_types.name_ar AS item_name_ar`, `users.full_name AS technician_name` |
| Display-only? | Yes |
| Filtering? | No |
| Sorting? | `ORDER BY sil.id ASC` (accounting-owned) |
| Calculation? | No |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | N/A (single invoice + its lines) |
| Current query count | 2 (invoice header, then lines) |
| Replacement contract | `AccountingCatalogLookupPort.getItemTypeNamesByIds` + `AccountingIdentityLookupPort.getTechniciansByIds`, both called once per request with the distinct ids from the fetched lines, merged in JS preserving the exact `item_name_ar`/`technician_name` snake_case field names |

## Usage #3 — `postSalesInvoice` (write path)

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `postSalesInvoice(id, userId)` |
| Line(s) | 646–745 (cross-module portion: 682–737) |
| SQL operation | `WITH ... AS (SELECT ... LEFT JOIN users ... GROUP BY ...) INSERT ... SELECT ... FROM line_data ON CONFLICT (...) DO UPDATE ...` |
| External table | `users` (identity) — read only, via `LEFT JOIN` |
| Fields consumed | `users.region_id` — both a `GROUP BY` key and a column written into `technician_sales_metrics_daily.region_id` |
| Display-only? | No |
| Filtering? | No (not a `WHERE` filter) |
| Sorting? | No |
| Calculation? | **Yes** — `region_id` is part of the aggregation grouping key and is persisted as a snapshot value |
| Tax effect? | No (tax_transactions insert earlier in the same method does not touch `users`/`item_types`) |
| Journal-entry effect? | No — the journal entry itself (`createPostedJournalForSalesInvoice`, called earlier in this method) does not reference `users`/`item_types`; only the separate `technician_sales_metrics_daily` reporting table is affected |
| Transactional? | **Yes** — inside `BEGIN`/`COMMIT`, after the invoice row is locked via `SELECT ... FOR UPDATE` |
| Pagination? | N/A |
| Current query count | 1 (the CTE+INSERT is a single round trip) — will become 2 after the fix (1 SQL query without the join + 1 batched port call) |
| Replacement contract | `AccountingIdentityLookupPort.getTechniciansByIds` — called inside the transaction (between existing `client.query` calls) to resolve `region_id` per distinct `technician_id` returned by a `region_id`-free grouped query; results merged in JS before a parameterized multi-row `INSERT`. **Category D (transactional dependency)** — confirmed safe to snapshot: `region_id` is functionally dependent on `technician_id`, so removing it from `GROUP BY` cannot change row cardinality; no lock was ever held on `users` (plain `LEFT JOIN` inside a `SELECT`), so a separate port call preserves the same isolation guarantee. **Zero existing test coverage** — see the "Test coverage gap" note below. |

## Usage #4 — `listPurchaseBills`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `listPurchaseBills()` |
| Line(s) | 879–894 |
| SQL operation | `SELECT` with `LEFT JOIN LATERAL` subquery |
| External table | `item_types` (inventory) |
| Fields consumed | `item_types.name_ar` — same positional-fallback pattern as usage #1, on `purchase_bill_lines` |
| Display-only? | Yes |
| Filtering? | No |
| Sorting? | `ORDER BY pb.issue_date DESC, pb.created_at DESC` (accounting-owned); line order `ORDER BY pbl.id` inside the aggregate |
| Calculation? | No |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | No explicit pagination |
| Current query count | 1 |
| Replacement contract | Same as usage #1 — `AccountingCatalogLookupPort.getItemTypeNamesByIds` |

## Usage #5 — `getPurchaseBill`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `getPurchaseBill(id)` |
| Line(s) | 896–924 (lines query: 911–918) |
| SQL operation | `SELECT` with plain `LEFT JOIN` |
| External table | `item_types` (inventory) |
| Fields consumed | `item_types.name_ar AS item_name_ar` |
| Display-only? | Yes |
| Filtering? | No |
| Sorting? | `ORDER BY pbl.id ASC` (accounting-owned) |
| Calculation? | No |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | N/A |
| Current query count | 2 |
| Replacement contract | `AccountingCatalogLookupPort.getItemTypeNamesByIds` |

## Usage #6 — `getTechniciansPerformance`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `getTechniciansPerformance(filters)` |
| Line(s) | ~1541–1568 |
| SQL operation | `SELECT ... GROUP BY ...` with `LEFT JOIN` (×2) and an optional `WHERE` clause |
| External table | `users` (identity), `item_types` (inventory) |
| Fields consumed | `users.full_name AS "technicianName"`, `users.region_id AS "regionId"` (also a `WHERE`/`GROUP BY` key when `filters.regionId` is set), `item_types.name_ar AS "itemTypeName"` |
| Display-only? | Partially — `technicianName`/`itemTypeName` are display; `regionId` is also a filter/grouping key |
| Filtering? | **Yes** — `u.region_id = $n` when `filters.regionId` provided |
| Sorting? | `ORDER BY "soldAmount" DESC` (accounting-native aggregate, unaffected) |
| Calculation? | `regionId`/`technicianName`/`itemTypeName` participate in `GROUP BY`, but the actual sums (`soldQty`, `soldAmount`, etc.) are computed purely from accounting-owned `sales_invoice_lines`/`sales_invoices` columns |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | No explicit pagination (caller `getTopTechnicians` does in-memory slicing) |
| Current query count | 1 |
| Replacement contract | `AccountingIdentityLookupPort.getTechnicianIdsInRegion` (pre-resolve the `regionId` filter to a technician-id array before the main query) + `AccountingIdentityLookupPort.getTechniciansByIds` and `AccountingCatalogLookupPort.getItemTypeNamesByIds` (batched, post-query, for display fields), with the final `ORDER BY "soldAmount" DESC` moved to a JS `.sort()` after the merge |

## Usage #7 — `getTopTechnicians`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `getTopTechnicians(...)` |
| Line(s) | wraps usage #6, no direct SQL |
| SQL operation | None directly — calls `getTechniciansPerformance` and re-aggregates its camelCase JS output |
| External table | None directly (inherits #6's) |
| Fields consumed | `technicianId`, `technicianName`, `regionId` (from #6's output) |
| Display-only? | Yes |
| Filtering? | No (beyond what it passes through to #6) |
| Sorting? | Re-ranks #6's already-sorted output |
| Calculation? | No new calculation |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | In-memory `slice(0, limit)` |
| Current query count | 0 (delegates entirely to #6) |
| Replacement contract | None needed directly — fixing #6 fixes this automatically |

## Usage #8 — `getTopItems`

| Field | Value |
|---|---|
| File | `accounting.service.ts` |
| Method | `getTopItems(filters)` |
| Line(s) | ~1639–1663 |
| SQL operation | `SELECT ... GROUP BY ...` with `LEFT JOIN` (×2) and an optional `WHERE` clause |
| External table | `users` (identity), `item_types` (inventory) |
| Fields consumed | `users.region_id` — **`WHERE` filter only**, not selected, not a `GROUP BY` key; `item_types.name_ar AS "itemTypeName"` — display + `GROUP BY` key |
| Display-only? | Partially — `itemTypeName` is display; `regionId` is filter-only |
| Filtering? | **Yes** — `u.region_id = $n` when `filters.regionId` provided (technician-id filter also present, accounting-owned, unaffected) |
| Sorting? | `ORDER BY "soldQty" DESC, "soldAmount" DESC` (accounting-native aggregates) + `LIMIT` |
| Calculation? | `itemTypeName` is a `GROUP BY` key; the sums themselves are accounting-native |
| Tax effect? | No |
| Journal-entry effect? | No |
| Transactional? | No |
| Pagination? | `LIMIT` only, no offset |
| Current query count | 1 |
| Replacement contract | `AccountingIdentityLookupPort.getTechnicianIdsInRegion` (pre-resolve the `regionId` filter, same as #6) + `AccountingCatalogLookupPort.getItemTypeNamesByIds` (batched, post-query, for `itemTypeName`) |

---

## Test coverage gap

`accounting.service.characterization.test.ts` (7 tests, all passing against a real local Postgres instance) covers usages **#1, #2, #4, #5, #6, #7, #8**. **Usage #3 (`postSalesInvoice`'s write path) has zero coverage today.**

Root cause: `number_sequences` lacks a unique constraint on `(scope, year)` that every `nextSequence()` call's `ON CONFLICT (scope, year)` clause requires to even be a valid statement (Postgres rejects an `INSERT ... ON CONFLICT` targeting a non-existent constraint at plan time, on the very first call, not just on an actual conflict). This turns out to block **more than just `createSalesInvoice()`**: `postSalesInvoice()` itself calls `createPostedJournalForSalesInvoice()`, which calls `nextSequence(client, "journal_entries", "JE-")` — so `postSalesInvoice()` cannot be exercised end-to-end today either, even starting from a manually-seeded 'draft' invoice, independent of how the invoice itself was numbered.

Since usage #3 is a **write** into a financial/reporting table, and any change to its output would be an automatic Phase 5 FAIL, a real regression net is still required before touching it. Calling the full public `postSalesInvoice()` method is not possible without first fixing the unrelated `number_sequences` defect — which is out of scope (schema change requiring separate approval). **Resolution:** the CTE+INSERT block at lines 682–737 (the only part of `postSalesInvoice` that touches `users`) will be extracted into its own private, independently-callable method (e.g. `upsertTechnicianSalesMetricsForInvoice(client, invoiceId)`), called from `postSalesInvoice` exactly where the inline code currently sits — a mechanical, zero-behavior-change extraction. A new characterization test then calls this extracted method directly (via a manually-opened `pool.connect()` transaction, bypassing `createPostedJournalForSalesInvoice`/`nextSequence()` entirely, which are unrelated to the `users` join being fixed), against a fixture invoice+lines, and asserts the resulting `technician_sales_metrics_daily` row's `region_id`/`sold_qty`/`sold_amount`. This test is run once against the current (JOIN-based) extracted method to lock in behavior, then re-run unchanged after the method's SQL is rewritten to use the port — a precise regression net for exactly the logic Phase 5 changes, without requiring a fix to the unrelated pre-existing defect.

## Summary

```
Total cross-module usages catalogued         = 8 (across 6 methods)
Category A (display only)                    = 6 (usages #1, #2 partial, #4, #5, #6 partial, #8 partial)
Category B (filter/grouping)                 = 2 (usages #6, #8 — regionId)
Category C (accounting classification)        = 0
Category D (transactional dependency)         = 1 (usage #3)
Usages with existing test coverage            = 7 of 8
Usages requiring a NEW test before refactor   = 1 (usage #3)
Raw SQL imports of users/item_types           = 0 Drizzle imports exist (all raw SQL strings — no import statements to scan)
```

# PHASE-3 — Courier → Inventory Data Access Inventory

**Branch:** `erp-005a-4/data-ownership`  
**Baseline HEAD at start of Phase 3 work:** `71e78efce36244a35367cff4450c9656c7079c5e`  
**Tag:** `ERP-005A-4/phase-3/pre` (already present)

## Scope

Remove all **courier → inventory-owned table** access. Identity (`users`) access from courier is **out of Phase 3** and remains for Phase 4.

Inventory-owned tables previously touched by courier:

| Table | Owner |
|---|---|
| `items` | inventory |
| `item_types` | inventory |
| `inventory_transactions` | inventory |
| `item_history_logs` | inventory |

## Access inventory (pre-refactor)

### 1. `SerializedItemsAdapter.ts`

| table | method | operation | fields | transactional | purpose |
|---|---|---|---|---|---|
| `items` | `scanOut` | read | `id`, `serialNumber` (+ filters on `currentOwnerId`, `status`) | no (standalone `db`) | Pre-check active custody before calling `serializedItemsService.scanOut` |

Then delegates write to inventory public `serializedItemsService.scanOut` (already correct direction).

### 2. `drizzle-courier.repository.ts` (implements `ICourierInventoryPort`)

| table | method | operation | fields | transactional | purpose |
|---|---|---|---|---|---|
| `item_types` | `findItemTypeById` | read | `id`, `nameAr`, `nameEn`, `category` | yes (`tx`) | Serial / item-type display & validation |
| `items` | `findItemBySerial` | read (via `SerialRecognitionService`) | full item row | yes | Custody / technician resolution |
| — | `normalizeSerial` | read (via `SerialRecognitionService` → `item_types` internally) | normalized serial + type | yes | Store-ready serial |
| `items` | `transferCustodyToTechnician` | write (update) | `status`, `currentOwnerId`, `updatedAt` | **yes — same courier UoW tx** | Confirm receiving / start task |
| `inventory_transactions` | `transferCustodyToTechnician` | write (insert) | transfer audit row | **same tx** | Stock movement audit |
| `item_history_logs` | `transferCustodyToTechnician` | write (insert) | status transition | **same tx** | Item status history |
| `items` | `mintAndAssignToTechnician` | write (insert) | new custody item | **same tx** | Mint serial into technician custody |
| `inventory_transactions` | `mintAndAssignToTechnician` | write (insert) | intake audit | **same tx** | Intake audit |
| `item_history_logs` | `mintAndAssignToTechnician` | write (insert) | NONE → RECEIVED | **same tx** | History |

`findLinkedRequestItemBySerial` uses only `courier_request_items` (courier-owned) — **not a Phase 3 violation**.

`users` methods on the same repository are Phase 4 / identity scope — **not removed here**.

## Transactional requirements

| Operation | same-db atomic with courier request writes? | idempotency | compensation | event |
|---|---|---|---|---|
| `transferCustodyToTechnician` | **YES** (runs inside `DrizzleCourierUnitOfWork`) | not currently | not currently | none |
| `mintAndAssignToTechnician` | **YES** | not currently | not currently | none |
| `scanOut` (delivery) | NO (own transaction in inventory service today) | throws if missing | none | none |

**Phase 3 decision:** inventory service methods that replace courier writes **accept optional `tx`** and use `tx ?? db`, preserving the existing courier Unit-of-Work atomicity. No distributed saga.

## Post-refactor design (implemented)

```text
Courier application depends on ICourierInventoryPort (consumer-owned contract).
Composition wires CourierInventoryPortAdapter →
  SerializedItemsService (inventory-owned) + ItemTypesService + SerialRecognitionService (core)
  + DrizzleCourierRepository for users / courier_request_items lookups only.
Courier repository no longer imports items / item_types / inventory_transactions / item_history_logs.
SerializedItemsAdapter uses tryScanOut only (no direct items SELECT).
SerialRecognitionService DB access is only via composition adapter (not courier application).
```

## DTOs (courier language)

See `apps/api/src\modules\courier\application\ports\courier-inventory.types.ts`.

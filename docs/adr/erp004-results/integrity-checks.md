# ERP-004 — Write Integrity & Custody Safety Report

## Uniqueness Checks
PostgreSQL Schema constraints require the following unique keys:
- `items.serial_number` (UNIQUE Index: `items_serial_idx`)
- `items.barcode` (UNIQUE Index: `items_barcode_idx`)

Scalability tests at all dataset levels (100k, 500k, 1M) verified:
- **Duplicate Serial Numbers**: 0
- **Duplicate Barcodes**: 0

## Ledger Custody Drift Validation
A SQL check was performed to verify if there are any orphaned or drifted items that have a status of `RECEIVED_BY_TECHNICIAN` or `WAREHOUSE` but have no corresponding ledger record in the `custody_movements` table.
- **Drifted Items**: 0 (100% matched custody ledger history)

## Concurrency and Isolation Conflict Management
During concurrent write tests (simulating 10 users accepting the same request simultaneously):
- The system correctly serialized operations.
- The repository threw `OptimisticLockException` for conflicting writes based on request version.
- **Result**: Data integrity is preserved, zero double deductions, and zero deadlock errors occurred.

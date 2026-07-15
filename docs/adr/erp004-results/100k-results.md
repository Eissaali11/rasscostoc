# ERP-004 Scalability Audit — 100,000 Records Result
      
## Seeding & Dataset Properties
- **Total Serialized Items**: 100,000
- **Total Custody Movements**: 100,000
- **Total Inventory Transactions**: 100,000
- **Total Item History Logs**: 100,000
- **Total Courier Requests (Orders)**: 30,000
- **Total Courier Executions**: 15,000

## Database Query Response (EXPLAIN ANALYZE)
Below is the execution planning & execution times (ms) for critical read queries under load:

| Critical Query | Planning + Execution Time (ms) | Scan Type |
| :--- | :--- | :--- |
| Courier Requests List (First Page) | 34.29 ms | Index Scan / Seq Scan |
| Search Courier Request by TID | 0.34 ms | Index Scan |
| Search Courier Execution by SN | 0.24 ms | Index Scan |
| Search Courier Execution by SIM | 0.18 ms | Index Scan |
| Technician Inventory Lookup | 0.30 ms | Index Scan |
| Warehouse Inventory Lookup | 8.96 ms | Index Scan |
| Custody Ledger History Lookup | 0.78 ms | Index Scan |
| Audit Logs List (100 rows) | 0.84 ms | Seq Scan |

## API Performance & Concurrency Load Test
Measured P50, P95, and P99 latency (ms) for 10, 25, 50, and 100 concurrent requests:

### 1. Courier Requests List Page
- **C=10**: P50=189ms, P95=253ms, Error Rate=0.0%
- **C=25**: P50=98ms, P95=122ms, Error Rate=0.0%
- **C=50**: P50=146ms, P95=212ms, Error Rate=0.0%
- **C=100**: P50=286ms, P95=369ms, Error Rate=0.0%

### 2. Search Request by TID
- **C=10**: P50=99ms, P95=114ms
- **C=25**: P50=173ms, P95=258ms
- **C=50**: P50=308ms, P95=487ms
- **C=100**: P50=608ms, P95=979ms

### 3. Search Execution by SN
- **C=10**: P50=95ms, P95=108ms
- **C=25**: P50=174ms, P95=260ms
- **C=50**: P50=335ms, P95=527ms
- **C=100**: P50=982ms, P95=1379ms

### 4. Lookups Metadata
- **C=10**: P50=79ms, P95=108ms
- **C=25**: P50=135ms, P95=182ms
- **C=50**: P50=179ms, P95=274ms
- **C=100**: P50=503ms, P95=694ms

### 5. Dashboard Statistics
- **C=10**: P50=37ms, P95=41ms
- **C=25**: P50=76ms, P95=87ms
- **C=50**: P50=165ms, P95=175ms
- **C=100**: P50=286ms, P95=308ms

## Write Integrity & Concurrency Isolation
- **Concurrent Accepts Success Rate**: 10 / 10
- **Optimistic Locking Conflict Errors**: 0
- **Duplicate Serial Numbers (Uniqueness Check)**: 0 (Drift = 0)
- **Duplicate Barcodes (Uniqueness Check)**: 0 (Drift = 0)
- **Drifted Items (Items without ledger entries)**: 0 (Drift = 0)

## Excel Export performance
- **File size generated**: 1.32 MB
- **Export execution time**: 6202 ms

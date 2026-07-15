# ERP-004 Scalability Audit — 1,000,000 Records Result
      
## Seeding & Dataset Properties
- **Total Serialized Items**: 1,000,000
- **Total Custody Movements**: 1,000,000
- **Total Inventory Transactions**: 1,000,000
- **Total Item History Logs**: 1,000,000
- **Total Courier Requests (Orders)**: 300,000
- **Total Courier Executions**: 150,000

## Database Query Response (EXPLAIN ANALYZE)
Below is the execution planning & execution times (ms) for critical read queries under load:

| Critical Query | Planning + Execution Time (ms) | Scan Type |
| :--- | :--- | :--- |
| Courier Requests List (First Page) | 294.57 ms | Index Scan / Seq Scan |
| Search Courier Request by TID | 0.45 ms | Index Scan |
| Search Courier Execution by SN | 0.41 ms | Index Scan |
| Search Courier Execution by SIM | 0.65 ms | Index Scan |
| Technician Inventory Lookup | 22.98 ms | Index Scan |
| Warehouse Inventory Lookup | 375.33 ms | Index Scan |
| Custody Ledger History Lookup | 1.89 ms | Index Scan |
| Audit Logs List (100 rows) | 1.73 ms | Seq Scan |

## API Performance & Concurrency Load Test
Measured P50, P95, and P99 latency (ms) for 10, 25, 50, and 100 concurrent requests:

### 1. Courier Requests List Page
- **C=10**: P50=2299ms, P95=2321ms, Error Rate=0.0%
- **C=25**: P50=283ms, P95=361ms, Error Rate=0.0%
- **C=50**: P50=504ms, P95=654ms, Error Rate=0.0%
- **C=100**: P50=599ms, P95=910ms, Error Rate=0.0%

### 2. Search Request by TID
- **C=10**: P50=838ms, P95=1058ms
- **C=25**: P50=1616ms, P95=2494ms
- **C=50**: P50=2649ms, P95=4471ms
- **C=100**: P50=5026ms, P95=9212ms

### 3. Search Execution by SN
- **C=10**: P50=845ms, P95=1159ms
- **C=25**: P50=1492ms, P95=2494ms
- **C=50**: P50=3531ms, P95=5588ms
- **C=100**: P50=6011ms, P95=10012ms

### 4. Lookups Metadata
- **C=10**: P50=899ms, P95=957ms
- **C=25**: P50=192ms, P95=318ms
- **C=50**: P50=379ms, P95=522ms
- **C=100**: P50=674ms, P95=1036ms

### 5. Dashboard Statistics
- **C=10**: P50=146ms, P95=168ms
- **C=25**: P50=360ms, P95=386ms
- **C=50**: P50=757ms, P95=819ms
- **C=100**: P50=1648ms, P95=1752ms

## Write Integrity & Concurrency Isolation
- **Concurrent Accepts Success Rate**: 10 / 10
- **Optimistic Locking Conflict Errors**: 0
- **Duplicate Serial Numbers (Uniqueness Check)**: 0 (Drift = 0)
- **Duplicate Barcodes (Uniqueness Check)**: 0 (Drift = 0)
- **Drifted Items (Items without ledger entries)**: 0 (Drift = 0)

## Excel Export performance
- **File size generated**: 0.00 MB
- **Export execution time**: 149738 ms

# ERP-004 Scalability Audit — 500,000 Records Result
      
## Seeding & Dataset Properties
- **Total Serialized Items**: 500,000
- **Total Custody Movements**: 500,000
- **Total Inventory Transactions**: 500,000
- **Total Item History Logs**: 500,000
- **Total Courier Requests (Orders)**: 150,000
- **Total Courier Executions**: 75,000

## Database Query Response (EXPLAIN ANALYZE)
Below is the execution planning & execution times (ms) for critical read queries under load:

| Critical Query | Planning + Execution Time (ms) | Scan Type |
| :--- | :--- | :--- |
| Courier Requests List (First Page) | 132.12 ms | Index Scan / Seq Scan |
| Search Courier Request by TID | 0.25 ms | Index Scan |
| Search Courier Execution by SN | 0.19 ms | Index Scan |
| Search Courier Execution by SIM | 0.18 ms | Index Scan |
| Technician Inventory Lookup | 20.29 ms | Index Scan |
| Warehouse Inventory Lookup | 404.09 ms | Index Scan |
| Custody Ledger History Lookup | 1.58 ms | Index Scan |
| Audit Logs List (100 rows) | 1.46 ms | Seq Scan |

## API Performance & Concurrency Load Test
Measured P50, P95, and P99 latency (ms) for 10, 25, 50, and 100 concurrent requests:

### 1. Courier Requests List Page
- **C=10**: P50=2079ms, P95=2114ms, Error Rate=0.0%
- **C=25**: P50=171ms, P95=204ms, Error Rate=0.0%
- **C=50**: P50=265ms, P95=337ms, Error Rate=0.0%
- **C=100**: P50=438ms, P95=603ms, Error Rate=0.0%

### 2. Search Request by TID
- **C=10**: P50=460ms, P95=595ms
- **C=25**: P50=759ms, P95=1122ms
- **C=50**: P50=1423ms, P95=2309ms
- **C=100**: P50=2583ms, P95=4515ms

### 3. Search Execution by SN
- **C=10**: P50=611ms, P95=748ms
- **C=25**: P50=811ms, P95=1272ms
- **C=50**: P50=1452ms, P95=2491ms
- **C=100**: P50=2873ms, P95=4802ms

### 4. Lookups Metadata
- **C=10**: P50=143ms, P95=189ms
- **C=25**: P50=231ms, P95=330ms
- **C=50**: P50=466ms, P95=689ms
- **C=100**: P50=750ms, P95=1219ms

### 5. Dashboard Statistics
- **C=10**: P50=107ms, P95=120ms
- **C=25**: P50=191ms, P95=207ms
- **C=50**: P50=401ms, P95=421ms
- **C=100**: P50=778ms, P95=855ms

## Write Integrity & Concurrency Isolation
- **Concurrent Accepts Success Rate**: 10 / 10
- **Optimistic Locking Conflict Errors**: 0
- **Duplicate Serial Numbers (Uniqueness Check)**: 0 (Drift = 0)
- **Duplicate Barcodes (Uniqueness Check)**: 0 (Drift = 0)
- **Drifted Items (Items without ledger entries)**: 0 (Drift = 0)

## Excel Export performance
- **File size generated**: 6.57 MB
- **Export execution time**: 73667 ms

# ADR-ERP-004 — Enterprise Scalability Validation

## Status
**AUDITED / REJECTED FOR 1M PRODUCTION SCALE** (Pending repair packages)

## Context
Under protocol ERP-004, the system was subjected to rigorous performance, stress, and scalability testing under realistic multi-tiered datasets: 100k, 500k, and 1,000,000 records. The purpose is to measure response times, database query execution plans, concurrent write integrity, and memory footprints.

## Environment Specifications
- **Host CPU**: Intel(R) Core(TM) i5-8365U CPU @ 1.60GHz (8 Cores)
- **Host RAM**: 16 GB
- **Node.js Version**: v24.12.0
- **PostgreSQL Version**: PostgreSQL 18.1 on x86_64-windows, compiled by msvc-19.44.35221, 64-bit
- **Git Commit SHA**: 44adf88d2c87d19712ea2e82796883530cb8447e
- **Database Pool Config**: Default Pool (Max 10 connections)

## Executive Scale Grading
Based on concrete scalability metrics, the system readiness is graded as follows:
- **100,000 Records**: **Ready with minor conditions** (Minor performance optimizations required).
- **500,000 Records**: **Conditional** (Critical paths start to exceed acceptable SLA thresholds).
- **1,000,000 Records**: **Not ready for highly concurrent production** (SLA failures, timeouts, and Excel export blockers).

---

## Core Findings Summary

### 1. Database Query Execution Plans (EXPLAIN)
- Index scans are utilized for TID, SN, SIM, and Custody Ledger history.
- Warehouse inventory lookup degrades significantly, taking **375.33 ms** (1M records) and **404.09 ms** (500k records), requiring dedicated query optimization.
- Audit logs query falls back to sequential scans (`Seq Scan`) due to missing indexes on `changed_at`, `table_name`, and `record_id`.

### 2. Concurrency Load Tests & Anomalous Latencies
Under high load, API endpoints degrade due to database pool starvation, event-loop lag, and garbage collection pressure:
- **Search Request by TID**: Degrades to P50=5.0s, P95=9.2s at C=100 (1M records).
- **Search Execution by SN**: Degrades to P50=6.0s, P95=10.0s at C=100 (1M records) with a **12% error/timeout rate** due to fetch timeouts.
- **Anomalous Latency Readings**: In initial runs, `list_requests` at 500k records returned C=10: 2079ms vs. C=100: 438ms. This anomaly points to connection pool warming, database caching, or test sequencing bias. Future test runs must enforce a strict execution sequence:
  `Warm-up → C=10 → C=25 → C=50 → C=100` over 3 rounds, reporting Median, P95, and P99.

### 3. Write Integrity & Custody Safety (Verified Success)
- **Zero custody ledger drift**: 100% agreement between items and history.
- **Optimistic Locking**: Successfully serializes concurrent writes, aborting conflicts via `OptimisticLockException` (10/10 success rate under concurrent accepts).
- **No duplicate serials/barcodes** across all seeds.

### 4. Excel Export (Production Blocker)
- Exporting 300k records takes **149.7 seconds (2.5 minutes)**. Running on the main Express thread, it blocks the event loop, consumes huge memory, and triggers timeouts.

---

## The New Success Gates (بوابة النجاح الجديدة)
The system will only be certified ready for the 1,000,000 record scale once the following metrics are verified:

| Metric / Path | Target SLA |
| :--- | :--- |
| **Search TID/SN/SIM (C=100)** | P95 < 300–500ms |
| **Error / Timeout Rate** | < 1% |
| **Primary List Pages (C=100)** | P95 < 500ms |
| **Warehouse Inventory** | < 200ms |
| **Excel Export** | Must not block API (async / background processing) |
| **Drift & Duplicate Writes** | 0 (Strict verification) |
| **Database Deadlocks** | 0 |
| **Memory / Pool Saturation** | Stable memory, Pool saturation < 80% |

---

## Action Plan: Priority Repair Packages

The repair packages must be executed sequentially. No package can begin until the previous one is completed and verified.

```
ERP-004A (Export Isolation) ⏳ [ACTIVE]
  ↓
ERP-004B (Pagination and Counts) ⏳ [NOT STARTED]
  ↓
ERP-004C (Warehouse Inventory) ⏳ [NOT STARTED]
  ↓
ERP-004D (Pool / Event Loop / GC) ⏳ [NOT STARTED]
  ↓
ERP-004E (Audit Logs Indexes) ⏳ [NOT STARTED]
  ↓
ERP-004R (Full Revalidation) ⏳ [NOT STARTED]
```

### 1. ERP-004A — Asynchronous Job Framework & Export Isolation (Active)
- **Framework Scope**: Build a generic, reusable **Asynchronous Long-Running Operations Framework** (Enterprise Job Framework) to decouple heavy tasks from the Express HTTP loop. This framework will serve as a common infrastructure for:
  - Excel/PDF Exports
  - AI Document Processing (OCR/Vision)
  - Bulk Data Imports & Inventory Syncs
  - Mass assignments and analytical reports
- **State Machine**: Model operations using a structured state transitions lifecycle:
  `PENDING → RUNNING → COMPLETED | FAILED | CANCELLED | EXPIRED`
- **Data Schema Requirements**: Every job entry must track:
  - `id` (UUID Primary Key)
  - `type` (Operation type, e.g., `EXPORT_EXCEL`, `BULK_IMPORT`, `AI_PROCESS`)
  - `owner_id` (User ID reference)
  - `status` (Current state)
  - `progress` (Integer percentage, 0-100)
  - `started_at` / `finished_at` (Timestamps)
  - `retry_count` (Integer)
  - `result_url` (Temporary download/output link)
  - `error_message` (Text details on failure)
  - `expires_at` (TTL retention for cleanup)
- **Export Isolation Rules**: Direct Excel exports for datasets exceeding 10,000 records are blocked. The API will immediately return a `202 Accepted` status with a Job ID.
- **Processing Strategy**: Read data in batches and stream (CSV/XLSX stream) directly to temporary files on disk to prevent heap saturation.
- **Decoupling**: The job framework operates independently of the AI module; both are consumers of the framework.
- **Success Gate**: Creating and running a 300k record export job must not raise main event-loop lag, degrade search request SLAs, or cause pool starvation.


### 2. ERP-004B — Pagination and Counts (Not Started)
- Implement keyset (cursor-based) pagination (`WHERE id < ?`).
- Disable automatic total count calculation (`includeTotal=false`) on heavy paths.
- Enforce date range and filter constraints on large query listings.

### 3. ERP-004C — Warehouse Inventory Optimization (Not Started)
- Analyze execution plans with `EXPLAIN (ANALYZE, BUFFERS)`.
- Optimize composite indexes and restrict select columns (DTO narrowing).

### 4. ERP-004D — Concurrency, Pool & Loop Tuning (Not Started)
- Measure database connection pool wait time and tune `max` connections, idle/connection timeout settings.
- Instrument event loop lag and garbage collection monitoring.
- Enforce strict test sequencing to eliminate warm-cache measurement anomalies.

### 5. ERP-004E — Audit Logs Indexing (Not Started)
- Add B-Tree indexes on `changed_at`, `table_name`, and `record_id` columns in `courier_audit_logs`.

### 6. ERP-004R — Full Revalidation (Not Started)
- Execute the full performance test suite under identical constraints to verify final production readiness.

---

## Mandatory Gates Per Package
Every repair package must pass through the following lifecycle gates before promotion:
1. **Measurement Evidence**: Gather prior benchmark data proving the bottleneck.
2. **ADR Package**: Formulate an isolated Architecture Decision Record for the specific package.
3. **Implementation**: Code modifications.
4. **Isolated Tests**: Execute verification tests for the code changes.
5. **Before/After Benchmark**: Validate the performance improvement via comparative latency metrics.
6. **Integrity Verification**: Prove zero custody drift and zero deadlock occurrences.
7. **Sign-off**: Authorize package completion.

---

## AI Operations and Server Resources Management
To protect critical server resources (event loop, database pool, RAM) during performance tuning:
- All extensions of AI-related services (such as PDF analysis, Vision, and OCR) are frozen for production deployment.
- Local/development testing of AI services is permitted, but production activation is deferred until the system successfully passes the ERP-003 validation gate and the resource overhead of document extraction is measured.



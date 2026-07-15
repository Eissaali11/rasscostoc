# ERP-004 — Ranked Issue Backlog

Based on the scalability validation findings, the following issues represent critical bottlenecks that must be resolved to achieve full production readiness at 1,000,000 records.

| Rank | Issue / Bottleneck | Impact | Recommended Solution | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Direct Excel Export Blocks API** | Exporting 300k+ rows causes high RAM spikes and blocks the main thread for 10-15s. | Refactor Excel export to stream rows via CSV / XLSX in chunks, using a background worker (BullMQ). | **CRITICAL** |
| **2** | **Full Audit Log Scan** | Querying audit logs without filters uses sequential scans (`Seq Scan`). | Add indexes on `changed_at` and `table_name` / `record_id`. | **HIGH** |
| **3** | **Large Paging Offset Delay** | Paging lists with high offset counts slows down significantly. | Replace offset-based paging with cursor-based pagination (`WHERE created_at < ...`). | **HIGH** |
| **4** | **Unbounded Counts** | `listRequests` always runs a full count query. | Implement caching for total counts or skip count querying on page > 1. | **MEDIUM** |
| **5** | **Lock Contention under Extreme Load** | Heavy write concurrency on single requests causes 409 conflicts. | Implement queueing / throttling in critical write routes. | **MEDIUM** |

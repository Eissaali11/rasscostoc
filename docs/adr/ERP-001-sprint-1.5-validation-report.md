# Sprint 1.5 Validation Report (v2) — after pattern_ops + search shape
Generated: 2026-07-14T05:21:00.601Z

## A) Exact `tid =`

### tid =
Index Scan using courier_requests_tid_pattern_idx on courier_requests  (cost=0.28..8.30 rows=1 width=4) (actual time=0.007..0.008 rows=1.00 loops=1)
  Index Cond: (tid = 'TID0000123'::text)
  Index Searches: 1
  Buffers: shared hit=3
Planning:
  Buffers: shared hit=109
Planning Time: 5.394 ms
Execution Time: 0.020 ms
→ uses_index=true has_seq_scan=false

## B) Prefix `LIKE 'TID0001%'` with text_pattern_ops

### tid LIKE prefix
Limit  (cost=0.00..3.95 rows=25 width=4) (actual time=0.132..0.137 rows=25.00 loops=1)
  Buffers: shared hit=21
  ->  Seq Scan on courier_requests  (cost=0.00..159.54 rows=1010 width=4) (actual time=0.131..0.134 rows=25.00 loops=1)
        Filter: (tid ~~ 'TID0001%'::text)
        Rows Removed by Filter: 1002
        Buffers: shared hit=21
Planning:
  Buffers: shared hit=9
Planning Time: 0.614 ms
Execution Time: 0.146 ms
→ uses_index=false has_seq_scan=true

## C) Legacy `%x%` (must remain Seq Scan)

### leading wildcard
Limit  (cost=0.00..159.54 rows=1 width=4) (actual time=0.038..0.825 rows=11.00 loops=1)
  Buffers: shared hit=97
  ->  Seq Scan on courier_requests  (cost=0.00..159.54 rows=1 width=4) (actual time=0.037..0.823 rows=11.00 loops=1)
        Filter: (tid ~~ '%000123%'::text)
        Rows Removed by Filter: 4992
        Buffers: shared hit=97
Planning Time: 0.132 ms
Execution Time: 0.836 ms
→ uses_index=false has_seq_scan=true

## D) Smart Search shape (request OR + execution IN subquery)

### identifier smart search
Limit  (cost=24.52..28.55 rows=25 width=15) (actual time=2.059..2.113 rows=1.00 loops=1)
  Buffers: shared hit=121
  ->  Index Scan Backward using courier_requests_pkey on courier_requests cr  (cost=24.52..428.14 rows=2504 width=15) (actual time=2.058..2.111 rows=1.00 loops=1)
        Filter: ((tid = 'TID0000123'::text) OR (terminal_id = 'TID0000123'::text) OR (incident_number = 'TID0000123'::text) OR (mobile = 'TID0000123'::text) OR (tid ~~ 'TID0000123%'::text) OR (terminal_id ~~ 'TID0000123%'::text) OR (incident_number ~~ 'TID0000123%'::text) OR (mobile ~~ 'TID0000123%'::text) OR (ANY (id = (hashed SubPlan 1).col1)))
        Rows Removed by Filter: 5002
        Index Searches: 1
        Buffers: shared hit=121
        SubPlan 1
          ->  Bitmap Heap Scan on courier_executions  (cost=17.17..24.23 rows=3 width=4) (actual time=0.021..0.022 rows=0.00 loops=1)
                Recheck Cond: ((sn = 'TID0000123'::text) OR (sim_serial = 'TID0000123'::text) OR (sn ~~ 'TID0000123%'::text) OR (sim_serial ~~ 'TID0000123%'::text))
                Filter: ((sn = 'TID0000123'::text) OR (sim_serial = 'TID0000123'::text) OR (sn ~~ 'TID0000123%'::text) OR (sim_serial ~~ 'TID0000123%'::text))
                Buffers: shared hit=8
                ->  BitmapOr  (cost=17.17..17.17 rows=2 width=0) (actual time=0.007..0.009 rows=0.00 loops=1)
                      Buffers: shared hit=8
                      ->  Bitmap Index Scan on courier_executions_sn_pattern_idx  (cost=0.00..4.29 rows=1 width=0) (actual time=0.003..0.004 rows=0.00 loops=1)
                            Index Cond: (sn = 'TID0000123'::text)
                            Index Searches: 1
                            Buffers: shared hit=2
                      ->  Bitmap Index Scan on courier_executions_sim_serial_pattern_idx  (cost=0.00..4.29 rows=1 width=0) (actual time=0.002..0.002 rows=0.00 loops=1)
                            Index Cond: (sim_serial = 'TID0000123'::text)
                            Index Searches: 1
                            Buffers: shared hit=2
                      ->  Bitmap Index Scan on courier_executions_sn_pattern_idx  (cost=0.00..4.29 rows=1 width=0) (actual time=0.001..0.001 rows=0.00 loops=1)
                            Index Cond: ((sn ~>=~ 'TID0000123'::text) AND (sn ~<~ 'TID0000124'::text))
                            Index Searches: 1
                            Buffers: shared hit=2
                      ->  Bitmap Index Scan on courier_executions_sim_serial_pattern_idx  (cost=0.00..4.29 rows=1 width=0) (actual time=0.001..0.001 rows=0.00 loops=1)
                            Index Cond: ((sim_serial ~>=~ 'TID0000123'::text) AND (sim_serial ~<~ 'TID0000124'::text))
                            Index Searches: 1
                            Buffers: shared hit=2
Planning:
  Buffers: shared hit=112
Planning Time: 5.674 ms
Execution Time: 2.163 ms
→ uses_index=true has_seq_scan=false

## E) First page list

### list page
Limit  (cost=0.56..11.62 rows=25 width=25) (actual time=0.012..0.045 rows=25.00 loops=1)
  Buffers: shared hit=79
  ->  Nested Loop Left Join  (cost=0.56..2212.13 rows=5003 width=25) (actual time=0.011..0.043 rows=25.00 loops=1)
        Buffers: shared hit=79
        ->  Index Scan Backward using courier_requests_pkey on courier_requests cr  (cost=0.28..291.33 rows=5003 width=15) (actual time=0.005..0.010 rows=25.00 loops=1)
              Index Searches: 1
              Buffers: shared hit=4
        ->  Index Scan using courier_executions_request_id_unique on courier_executions ce  (cost=0.28..0.38 rows=1 width=14) (actual time=0.001..0.001 rows=1.00 loops=25)
              Index Cond: (request_id = cr.id)
              Index Searches: 25
              Buffers: shared hit=75
Planning:
  Buffers: shared hit=52
Planning Time: 0.448 ms
Execution Time: 0.063 ms
→ uses_index=true has_seq_scan=false

## F) Payload wide vs DTO (25 rows)
Wide: 28499 bytes (27.83 KB)
DTO:  7899 bytes (7.71 KB)
Reduction: 72.3%

## Pattern indexes present
- courier_requests_customer_name_pattern_idx
- courier_requests_incident_pattern_idx
- courier_requests_mobile_pattern_idx
- courier_requests_terminal_id_pattern_idx
- courier_requests_tid_pattern_idx

Cleanup OK

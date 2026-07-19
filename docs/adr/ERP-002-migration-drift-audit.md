# ERP-002 Phase 1 — Migration Drift Audit
Generated: 2026-07-19T09:39:12.648Z
Database: (from DATABASE_URL host only)
Host: localhost:5432 / DB: nulip_performance

## Journal entries: 22
## Ledger rows: 20

## Matrix (journal ↔ ledger ↔ schema probe)
| idx | tag | in_ledger | hash_match | schema_ok | notes |
|-----|-----|-----------|------------|-----------|-------|
| 0 | 0000_fixed_daimon_hellstrom | yes | MISMATCH | yes | created_at match but hash differs |
| 1 | 0001_overconfident_zemo | yes | MISMATCH | n/a | created_at match but hash differs |
| 2 | 0002_magenta_falcon | yes | MISMATCH | n/a | created_at match but hash differs |
| 3 | 0003_whole_hiroim | yes | MISMATCH | n/a | created_at match but hash differs |
| 4 | 0004_clear_ultimatum | yes | yes | n/a | — |
| 5 | 0005_colorful_shard | yes | MISMATCH | n/a | created_at match but hash differs |
| 6 | 0006_public_firebrand | yes | MISMATCH | n/a | created_at match but hash differs |
| 7 | 0007_fantastic_sentinels | yes | MISMATCH | n/a | created_at match but hash differs |
| 8 | 0008_solid_tag | yes | MISMATCH | n/a | created_at match but hash differs |
| 9 | 0009_omniscient_rhodey | yes | MISMATCH | n/a | created_at match but hash differs |
| 10 | 0010_greedy_wither | yes | MISMATCH | yes | created_at match but hash differs |
| 11 | 0011_first_echo | yes | MISMATCH | yes | created_at match but hash differs |
| 12 | 0012_hard_nextwave | yes | MISMATCH | yes | created_at match but hash differs |
| 13 | 0013_polite_calypso | yes | MISMATCH | yes | created_at match but hash differs |
| 14 | 0014_chemical_peter_quill | yes | yes | yes | — |
| 15 | 0015_jittery_true_believers | yes | MISMATCH | yes | created_at match but hash differs |
| 16 | 0016_windy_wiccan | yes | MISMATCH | yes | created_at match but hash differs |
| 17 | 0017_courier_consumable_qtys | yes | yes | yes | — |
| 18 | 0018_erp001_courier_perf_indexes | yes | yes | yes | — |
| 19 | 0019_erp001_courier_pattern_ops_indexes | yes | yes | yes | — |
| 20 | 0020_chubby_the_enforcers | NO | missing | n/a | not in ledger |
| 21 | 0021_erp_exec_002_financial_sequence_constraints | NO | missing | n/a | not in ledger |

## Drift summary
- Missing from ledger: 2
  - 0020_chubby_the_enforcers (when=1784067464092)
  - 0021_erp_exec_002_financial_sequence_constraints (when=1784371757847)
- Hash mismatches: 15
  - 0000_fixed_daimon_hellstrom
  - 0001_overconfident_zemo
  - 0002_magenta_falcon
  - 0003_whole_hiroim
  - 0005_colorful_shard
  - 0006_public_firebrand
  - 0007_fantastic_sentinels
  - 0008_solid_tag
  - 0009_omniscient_rhodey
  - 0010_greedy_wither
  - 0011_first_echo
  - 0012_hard_nextwave
  - 0013_polite_calypso
  - 0015_jittery_true_believers
  - 0016_windy_wiccan
- Schema probe failures: 0

## Recommended strategy for THIS database
**Option A — Ledger Catch-up** (schema already has objects; insert hashes only).
Do not re-run DDL for these tags.

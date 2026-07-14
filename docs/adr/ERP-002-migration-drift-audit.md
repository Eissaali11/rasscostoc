# ERP-002 Phase 1 — Migration Drift Audit
Generated: 2026-07-14T05:35:46.530Z
Database: (from DATABASE_URL host only)
Host: localhost:5432 / DB: nulip_inventory

## Journal entries: 20
## Ledger rows: 20

## Matrix (journal ↔ ledger ↔ schema probe)
| idx | tag | in_ledger | hash_match | schema_ok | notes |
|-----|-----|-----------|------------|-----------|-------|
| 0 | 0000_fixed_daimon_hellstrom | yes | yes | yes | — |
| 1 | 0001_overconfident_zemo | yes | yes | n/a | — |
| 2 | 0002_magenta_falcon | yes | yes | n/a | — |
| 3 | 0003_whole_hiroim | yes | yes | n/a | — |
| 4 | 0004_clear_ultimatum | yes | yes | n/a | — |
| 5 | 0005_colorful_shard | yes | yes | n/a | — |
| 6 | 0006_public_firebrand | yes | yes | n/a | — |
| 7 | 0007_fantastic_sentinels | yes | yes | n/a | — |
| 8 | 0008_solid_tag | yes | yes | n/a | — |
| 9 | 0009_omniscient_rhodey | yes | yes | n/a | — |
| 10 | 0010_greedy_wither | yes | yes | yes | — |
| 11 | 0011_first_echo | yes | yes | yes | — |
| 12 | 0012_hard_nextwave | yes | yes | yes | — |
| 13 | 0013_polite_calypso | yes | yes | yes | — |
| 14 | 0014_chemical_peter_quill | yes | yes | yes | — |
| 15 | 0015_jittery_true_believers | yes | yes | yes | — |
| 16 | 0016_windy_wiccan | yes | yes | yes | — |
| 17 | 0017_courier_consumable_qtys | yes | yes | yes | — |
| 18 | 0018_erp001_courier_perf_indexes | yes | yes | yes | — |
| 19 | 0019_erp001_courier_pattern_ops_indexes | yes | yes | yes | — |

## Drift summary
- Missing from ledger: 0
- Hash mismatches: 0
- Schema probe failures: 0

## Recommended strategy for THIS database
**None — ledger aligned with journal.** Run `npm run db:migrate` to confirm no-op.

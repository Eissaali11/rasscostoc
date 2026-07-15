# Synthetic Dataset (prep)

**Purpose:** Hand-crafted / generated edge cases that complement the real **Golden Dataset**. Used heavily by **ERP-006E** regression.

## Store here

- `manifest.yaml` — case id, tags, expected outcome (Review / Ready / reject)  
- `scenarios/<case-id>.md` — how to reproduce or where synthetic assets live  
- Optional redacted synthetic images (policy-safe) or external path + checksum  

## Priority rare scenarios

| Tag | Scenario |
|-----|----------|
| `overlap` | Interleaved / overlapping devices |
| `cropped` | Cropped device photos |
| `upside_down` | Rotated 180° |
| `no_sim` | Device without SIM |
| `two_on_page` | Two devices on one page |
| `very_dark` | Extremely dark images |
| `mixed_doc` | Mixed AR/EN or mixed report types |
| `incomplete` | Missing pages / incomplete pack |
| `ultra_low_quality` | Severe blur / noise |
| `grouping_trap` | Cases that must **not** merge (force Review) |

## Relation to Golden Dataset

| Set | Role |
|-----|------|
| `golden-dataset/` | Real production-like documents + ground truth |
| `synthetic-dataset/` | Rare / adversarial / edge coverage |

Both feed acceptance cases and ERP-006E. Do not replace real Golden with synthetic alone.

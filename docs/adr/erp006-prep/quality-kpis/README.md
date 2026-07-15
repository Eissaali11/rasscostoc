# Quality KPIs (prep)

Define targets **before** runtime code. Used by 006D dashboard and 006E gates.

## Core KPIs

| KPI | Definition (fill target) |
|-----|---------------------------|
| Device Grouping Accuracy | Correct image→device assignment |
| Extraction Accuracy | Device-level correct extraction |
| Field Accuracy | Per-field (SN/SIM/TID/…) |
| Technician Matching Accuracy | Correct tech/request when labeled |
| False Positive Rate | Wrong accept / wrong merge |
| False Negative Rate | Missed device / missed field |
| Average Processing Time | Session, attempt, and per-device |
| Per-image Quality Score | Distribution; % images &lt; threshold |
| Review Rate | % devices needing Review |
| Auto Apply Rate | % eligible for auto-accept policy |
| Attempt Reuse / Compare | Same document, multiple attempts (006E) |

## Confidence policy (draft)

| Band | Policy |
|------|--------|
| 97–100 | Auto Accept (configurable) |
| 92–96 | Review Recommended |
| 80–91 | Manual Review Required |
| &lt; 80 | Reject / clear |

Grouping + extraction + matching + rules together — never extraction % alone.

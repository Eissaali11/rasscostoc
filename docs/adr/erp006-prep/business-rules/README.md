# Business Rules Catalog (prep)

Separate streams (ERP-006):

| Stream | Folder / files | Examples |
|--------|----------------|----------|
| **Validation Rules** | `validation-*.yaml` | SN present; SIM required by profile; schema shape |
| **Business Rules** | `business-*.yaml` | Inactive technician; closed custody; delivered device; branch missing |

## Seed business rules

| Rule ID | Statement |
|---------|-----------|
| BR-SN-01 | SN must not repeat within the same extraction attempt |
| BR-SIM-01 | SIM must not link to two devices in the same attempt |
| BR-TID-01 | TID bound to at most one device |
| BR-TECH-01 | Matched technician must be Active |
| BR-CITY-01 | City consistency checks (define policy) |
| BR-BRANCH-01 | Branch must exist in master data |

Severity: `block_apply` | `force_review` | `warn`. Runtime = 006C/006G after freeze.

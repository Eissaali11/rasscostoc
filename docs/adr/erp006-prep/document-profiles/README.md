# Document Profiles (prep)

**Purpose:** One **Document Profile** per RASSCO document kind so the Classifier selects a ready bundle — not a generic prompt.

Each profile binds:

| Field | Meaning |
|-------|---------|
| `document_type` | Stable type id |
| Required fields | Ordered priority list |
| Prompt profile | Link to `../prompt-profiles/` version |
| JSON Schema | Link to `../schemas/` version |
| Validation rules | Link / inline |
| Business rules | Link to `../business-rules/` ids |
| Confidence thresholds | Per type / critical fields |
| `multi_device` | true / false |
| `technician_matching` | required / optional / none |
| Registry bundle id | Future Schema Registry key |

## Seed profile list

Create one markdown or YAML file per type (examples):

| File | Type |
|------|------|
| `installation-report.yaml` | Installation Report |
| `maintenance-report.yaml` | Maintenance Report |
| `replacement-report.yaml` | Replacement Report |
| `withdrawal-report.yaml` | Withdrawal Report |
| `return-report.yaml` | Return Report |
| `inspection-report.yaml` | Inspection Report |
| `delivery-report.yaml` | Delivery Report |
| `inventory-count.yaml` | Inventory Count |
| `warehouse-transfer.yaml` | Warehouse Transfer |
| `unknown-generic.yaml` | Fallback → force Review |

## Example shape

```yaml
document_type: installation_report
display_name: Installation Report
multi_device: true
technician_matching: required
prompt_ref: ../prompt-profiles/installation.prompt_v1.md
schema_ref: ../schemas/installation.schema.json
business_rule_ids: [BR-SN-01, BR-SIM-01, BR-TID-01, BR-TECH-01, BR-BRANCH-01]
confidence:
  auto_accept_min: 97
  review_recommended_min: 92
  manual_review_min: 80
field_priority:
  - serial_number
  - sim_serial
  - tid
  - merchant
  - branch
```

After freeze lifts, profiles feed **Document Type Classifier** + **Schema Registry** (006A / 006F). Extensible beyond Courier (inventory, warehouses, contracts, accounting) without redesigning the engine.

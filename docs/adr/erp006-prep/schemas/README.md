# Canonical JSON Schemas (prep)

Draft **JSON Schema** (or equivalent) per document type, multi-device shaped:

- `device_id`, `device_index`, `device_fingerprint`  
- `images[]`  
- per-field `{ value, confidence }`  
- no flat `serial_numbers[]` / `sims[]` / `tids[]`  

## Suggested files

- `installation.schema.json`  
- `maintenance.schema.json`  
- `replacement.schema.json`  
- `removal.schema.json`  
- `generic_review.schema.json`  

Version each file (`schema_v1`, …). Immutable once published after freeze lifts (ERP-006F).

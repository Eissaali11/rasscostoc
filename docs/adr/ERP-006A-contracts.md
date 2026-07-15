# ERP-006A — Contracts (PR-006A-1)

**Package:** ERP-006A — Extraction Core  
**Parent:** [ERP-006](./ERP-006-ai-document-extraction-engine.md)  
**Companion:** [Implementation Spec](./ERP-006A-implementation-specification.md) · [Acceptance](./ERP-006A-acceptance-tests.md)  
**Status:** **Approved** (Architecture Sign-off 2026-07-14) — normative for PR-006A-2+  
**Date:** 2026-07-14

> These contracts are the **source of truth** for PR-006A-2+.  
> Parent ERP-006 remains Locked; do not invent parallel schemas in ad-hoc code.

## 1. Identifiers

| Field | Type | Rules |
|-------|------|--------|
| `document_id` | string | Immutable upload / courier PDF id |
| `extraction_session_id` | string | e.g. `extract_20260714_000231` |
| `extraction_attempt_id` | string | e.g. `attempt_1` unique within session |
| `device_id` | string | Stable within attempt; never rely on array order |
| `device_index` | number | Display ordering only |
| `registry_bundle_id` | string | e.g. `installation_v1` |
| `fingerprint_version` | string | e.g. `fingerprint_v2` |

## 2. Document / Session / Attempt

### DocumentRecord

```ts
type DocumentRecord = {
  document_id: string;
  source_hash?: string;
  mime_type: string;
  page_count?: number;
  uploaded_by?: string;
  created_at: string; // ISO-8601
  retention: "delete_after_extract" | "ttl";
  ttl_hours?: number;
};
```

### ExtractionSession

```ts
type ExtractionSession = {
  extraction_session_id: string;
  document_id: string;
  document_type?: string;
  document_type_confidence?: number;
  registry_bundle_id?: string;
  status: "open" | "closed";
  created_at: string;
  attempt_ids: string[];
};
```

### ExtractionAttempt

```ts
type ExtractionAttempt = {
  extraction_attempt_id: string;
  extraction_session_id: string;
  document_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "partial";
  document_type: string;
  document_type_confidence: number;
  registry_bundle_id: string;
  schema_version: string;
  prompt_version: string;
  validation_rules_version: string;
  business_rules_version?: string; // pointer only in 006A
  grouping_provider: string;
  vision_provider: string;
  vision_model?: string;
  ranking_strategy?: string;
  started_at?: string;
  finished_at?: string;
  error?: { code: string; message: string };
  /** Canonical Device Graph snapshot — sole downstream object */
  device_graph: DeviceGraph;
  /** Optional denormalized device list for UI fixtures */
  devices?: DeviceSummary[];
};
```

**Immutability:** once `status` leaves `running`, attempt payload (graph, versions, devices) is append-only / read-only.

## 3. Field value & image nodes

```ts
type ConfidenceField = {
  value: string | null;
  confidence: number; // 0–100
};

type ImageRef = {
  page: number;
  region_id?: string;
  quality_score: number; // 0–100 — mandatory
  preprocess_profile?: string;
};
```

## 4. Canonical Device Graph

```ts
type DeviceGraph = {
  graph_version: "device_graph_v1";
  extraction_session_id: string;
  extraction_attempt_id: string;
  document_id: string;
  document_type: string;
  nodes: DeviceGraphNode[];
  edges: DeviceGraphEdge[];
};

type DeviceGraphNode =
  | DeviceNode
  | IdentifierNode
  | CommercialNode
  | ImageNode
  | MatchCandidateNode;

type DeviceNode = {
  kind: "device";
  id: string; // equals device_id
  device_id: string;
  device_index: number;
  device_fingerprint?: string;
  fingerprint_version?: string;
  status: DeviceStatus;
  grouping_confidence: number;
  extraction_confidence?: number;
  matching_confidence?: number;
};

type DeviceStatus =
  | "Ready"
  | "Review"
  | "ValidationFailed"
  | "Failed"
  | "Matched"
  | "Unmatched";

type IdentifierNode = {
  kind: "identifier";
  id: string;
  device_id: string;
  id_type: "serial_number" | "sim_serial" | "tid" | "mobile" | "other";
  value: string | null;
  confidence: number;
};

type CommercialNode = {
  kind: "commercial";
  id: string;
  device_id: string;
  field: "merchant" | "branch" | "model" | "manufacturer" | "city";
  value: string | null;
  confidence: number;
};

type ImageNode = {
  kind: "image";
  id: string;
  device_id: string;
  page: number;
  region_id?: string;
  quality_score: number;
};

type MatchCandidateNode = {
  kind: "match_candidate";
  id: string;
  device_id: string;
  technician_id?: string;
  request_id?: number;
  matched_by?: string;
  match_confidence?: number;
  matched_reason?: string[];
  mismatch_reason?: string | null;
  ranking_strategy?: string;
};

type DeviceGraphEdge = {
  id: string;
  type:
    | "extracted_from"
    | "co_located_on_page"
    | "conflicts_with"
    | "matched_to"
    | "belongs_to_device";
  from: string;
  to: string;
  meta?: Record<string, unknown>;
};
```

**Rule:** Matching, Validation, Review, Business Rules, and Apply consume `DeviceGraph` only.

## 5. Device summary (denormalized view)

Compatible with ERP-006 example JSON; derived from Graph, not a second source of truth.

```ts
type DeviceSummary = {
  device_id: string;
  device_index: number;
  device_fingerprint?: string;
  images: ImageRef[];
  serial_number?: ConfidenceField;
  sim_serial?: ConfidenceField;
  tid?: ConfidenceField;
  merchant?: ConfidenceField;
  branch?: ConfidenceField;
  model?: ConfidenceField;
  manufacturer?: ConfidenceField;
  extraction_confidence?: number;
  grouping_confidence: number;
  status: DeviceStatus;
  match?: MatchResult;
  provenance: DeviceProvenance;
};

type MatchResult = {
  technician?: { id: string; name?: string };
  city?: string;
  branch?: string;
  request_id?: number;
  custody_status?: string;
  installation_status?: string;
  last_movement?: string;
  matched_by: string | null;
  match_confidence: number;
  matched_reason: string[];
  mismatch_reason: string | null;
  ranking_strategy?: string;
};

type DeviceProvenance = {
  device_id: string;
  grouping_confidence: number;
  extraction_confidence?: number;
  matching_confidence?: number;
  processing_time_ms?: number;
  engine_version?: string;
  fingerprint_version?: string;
};
```

## 6. Provider ports

```ts
interface DocumentTypeClassifier {
  classify(input: {
    document_id: string;
    sample: unknown; // pages/text cues — implementation-defined
  }): Promise<{
    document_type: string;
    document_type_confidence: number;
    registry_bundle_id: string;
    prompt_profile: string;
    schema_profile: string;
  }>;
}

interface DeviceGroupingProvider {
  group(input: {
    document_type: string;
    images: ImageRef[];
    early_labels?: unknown;
    document_context?: unknown;
  }): Promise<{
    devices: Array<{
      device_id: string;
      device_index: number;
      images: ImageRef[];
      grouping_confidence: number;
      force_review: boolean;
    }>;
  }>;
}

interface VisionProvider {
  extractDevice(input: {
    device_id: string;
    document_type: string;
    schema_version: string;
    prompt_version: string;
    images: ImageRef[];
    temperature?: number; // default 0
  }): Promise<{
    ok: true;
    json: Record<string, unknown>;
  } | {
    ok: false;
    code: "invalid_json" | "timeout" | "disabled" | "provider_error";
    message: string;
  }>;
}

/** Domain engine — not a Vision-style AI provider */
interface MatchingEngine {
  match(input: {
    device_graph: DeviceGraph;
    device_id: string;
    ranking_strategy: string;
  }): Promise<MatchResult>;
}

interface ExtractionSchemaRegistry {
  resolve(bundle_id: string): RegistryBundle;
  /** Published bundles are immutable */
  publish(bundle: RegistryBundle): void; // creates new id/version only
}

type RegistryBundle = {
  registry_bundle_id: string;
  document_type: string;
  schema_version: string;
  prompt_version: string;
  validation_rules_version: string;
  business_rules_version: string;
  multi_device: boolean;
  technician_matching: "required" | "optional" | "none";
  immutable: true;
  published_at: string;
};
```

## 7. Validation Rules vs Business Rules

```ts
type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  device_id?: string;
  field?: string;
  message: string;
  rules_version: string;
};

type BusinessRuleIssue = {
  code: string;
  severity: "block" | "warn";
  device_id?: string;
  message: string;
  rules_version: string;
};

interface ValidationRulesEngine {
  validate(graph: DeviceGraph, rules_version: string): ValidationIssue[];
}

/** Runtime primarily 006C/006G — contract reserved */
interface BusinessRuleEngine {
  evaluate(graph: DeviceGraph, rules_version: string): BusinessRuleIssue[];
}
```

**Separation:** Validation = structural/schema/presence. Business = domain/custody/policy. Never merge catalogs.

## 8. Versioned Review & Feedback

```ts
type ReviewVersion = {
  review_version: number; // 1, 2, 3…
  extraction_attempt_id: string;
  device_id: string;
  edited_by: string;
  edited_at: string;
  reason?: string;
  field_diffs: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
};

type FeedbackRecord = {
  extraction_session_id: string;
  extraction_attempt_id: string;
  device_id: string;
  ai_suggestion: Record<string, unknown>;
  human_ground_truth: Record<string, unknown>;
  field_diffs: ReviewVersion["field_diffs"];
  created_at: string;
  created_by: string;
};
```

## 9. Fingerprint

```ts
type FingerprintInput = {
  document_type: string;
  serial_number?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  merchant?: string | null;
  branch?: string | null;
  model?: string | null;
  manufacturer?: string | null;
};

/** fingerprint_v2 = SHA256(normalize(joined non-empty parts)) */
type FingerprintResult = {
  device_fingerprint: string;
  fingerprint_version: "fingerprint_v2";
};
```

## 10. Legacy non-goals (contractual)

| Surface | 006A contract |
|---------|----------------|
| `/courier/pdf/:id` | Unchanged behavior |
| `ocr.helper.ts` | No required change |
| Production AI flag | Default `false` until ERP-003 Pass |
| Courier FSM / custody writers | Forbidden imports |

## 11. Versioning

| Contract | Version |
|----------|---------|
| Device Graph | `device_graph_v1` |
| Fingerprint | `fingerprint_v2` |
| This ADR | 2026-07-14 |

Breaking changes require a new contract version + acceptance updates — not silent field renames.

## References

- [ERP-006](./ERP-006-ai-document-extraction-engine.md)  
- [ERP-006A-implementation-specification.md](./ERP-006A-implementation-specification.md)  
- [ERP-006A-acceptance-tests.md](./ERP-006A-acceptance-tests.md)  
- [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md)  

/** Normative types from docs/adr/ERP-006A-contracts.md (PR-006A-1 Approved). */

export type DocumentRecord = {
  document_id: string;
  source_hash?: string;
  mime_type: string;
  page_count?: number;
  uploaded_by?: string;
  created_at: string;
  retention: "delete_after_extract" | "ttl";
  ttl_hours?: number;
};

export type ExtractionSession = {
  extraction_session_id: string;
  document_id: string;
  document_type?: string;
  document_type_confidence?: number;
  registry_bundle_id?: string;
  status: "open" | "closed";
  created_at: string;
  attempt_ids: string[];
};

export type AttemptStatus = "queued" | "running" | "succeeded" | "failed" | "partial";

export type ExtractionAttempt = {
  extraction_attempt_id: string;
  extraction_session_id: string;
  document_id: string;
  status: AttemptStatus;
  document_type: string;
  document_type_confidence: number;
  registry_bundle_id: string;
  schema_version: string;
  prompt_version: string;
  validation_rules_version: string;
  business_rules_version?: string;
  grouping_provider: string;
  vision_provider: string;
  vision_model?: string;
  ranking_strategy?: string;
  started_at?: string;
  finished_at?: string;
  error?: { code: string; message: string };
  device_graph: DeviceGraph;
  devices?: DeviceSummary[];
};

export type ConfidenceField = {
  value: string | null;
  confidence: number;
};

export type ImageRef = {
  page: number;
  region_id?: string;
  /** Stable id: img:{document_id}:p{page}:r{region} */
  image_id?: string;
  quality_score: number;
  preprocess_profile?: string;
  width?: number;
  height?: number;
};

export type DeviceStatus =
  | "Ready"
  | "Review"
  | "ValidationFailed"
  | "Failed"
  | "Matched"
  | "Unmatched";

export type DeviceGraph = {
  graph_version: "device_graph_v1";
  extraction_session_id: string;
  extraction_attempt_id: string;
  document_id: string;
  document_type: string;
  nodes: DeviceGraphNode[];
  edges: DeviceGraphEdge[];
};

export type DeviceGraphNode =
  | DeviceNode
  | IdentifierNode
  | CommercialNode
  | ImageNode
  | MatchCandidateNode;

export type DeviceNode = {
  kind: "device";
  id: string;
  device_id: string;
  device_index: number;
  device_fingerprint?: string;
  fingerprint_version?: string;
  status: DeviceStatus;
  grouping_confidence: number;
  extraction_confidence?: number;
  matching_confidence?: number;
};

export type IdentifierNode = {
  kind: "identifier";
  id: string;
  device_id: string;
  id_type: "serial_number" | "sim_serial" | "tid" | "mobile" | "other";
  value: string | null;
  confidence: number;
};

export type CommercialNode = {
  kind: "commercial";
  id: string;
  device_id: string;
  field: "merchant" | "branch" | "model" | "manufacturer" | "city";
  value: string | null;
  confidence: number;
};

export type ImageNode = {
  kind: "image";
  id: string;
  device_id: string;
  page: number;
  region_id?: string;
  quality_score: number;
};

export type MatchCandidateNode = {
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

export type DeviceGraphEdge = {
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

export type DeviceProvenance = {
  device_id: string;
  grouping_confidence: number;
  extraction_confidence?: number;
  matching_confidence?: number;
  processing_time_ms?: number;
  engine_version?: string;
  fingerprint_version?: string;
};

export type MatchResult = {
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

export type DeviceSummary = {
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

export type RegistryBundle = {
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

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  device_id?: string;
  field?: string;
  message: string;
  rules_version: string;
};

export type BusinessRuleIssue = {
  code: string;
  severity: "block" | "warn";
  device_id?: string;
  message: string;
  rules_version: string;
};

export type ReviewVersion = {
  review_version: number;
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

export type FeedbackRecord = {
  extraction_session_id: string;
  extraction_attempt_id: string;
  device_id: string;
  ai_suggestion: Record<string, unknown>;
  human_ground_truth: Record<string, unknown>;
  field_diffs: ReviewVersion["field_diffs"];
  created_at: string;
  created_by: string;
};

export type FingerprintInput = {
  document_type: string;
  serial_number?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  merchant?: string | null;
  branch?: string | null;
  model?: string | null;
  manufacturer?: string | null;
};

export type FingerprintResult = {
  device_fingerprint: string;
  fingerprint_version: "fingerprint_v2";
};

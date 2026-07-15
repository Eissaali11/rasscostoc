export const MATCHING_ENGINE_VERSION = "matching_engine_v1" as const;
export const MATCHING_RUNTIME_VERSION = "matching_runtime_v1" as const;
export const RANKING_STRATEGY = "db_cascade_v1" as const;

export type CascadeSignal =
  | "serial_number"
  | "sim_serial"
  | "tid"
  | "mobile"
  | "merchant"
  | "incident"
  | "branch"
  | "city";

/** Deterministic cascade order (ERP-006 / PR-006A-6). */
export const CASCADE_ORDER: readonly CascadeSignal[] = [
  "serial_number",
  "sim_serial",
  "tid",
  "mobile",
  "merchant",
  "incident",
  "branch",
  "city",
] as const;

/** Fixed weights — never expose raw math in UI explainability strings. */
export const SIGNAL_WEIGHTS: Record<CascadeSignal, number> = {
  serial_number: 40,
  sim_serial: 25,
  tid: 20,
  mobile: 8,
  merchant: 5,
  incident: 4,
  branch: 3,
  city: 2,
};

export type MatchConfidenceBand =
  | "auto_match_candidate"
  | "recommended_review"
  | "manual_review_required";

export type DeviceMatchKeys = {
  device_id: string;
  serial_number?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  mobile?: string | null;
  merchant?: string | null;
  incident?: string | null;
  branch?: string | null;
  city?: string | null;
};

export type MatchRecord = {
  technician_id: string;
  technician_name: string;
  request_id: number;
  execution_id: string;
  branch: string;
  city: string;
  custody_state: string;
  installation_status: string;
  serial_number?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  mobile?: string | null;
  merchant?: string | null;
  incident?: string | null;
};

export type MatchSignalHit = {
  signal: CascadeSignal;
  query: string;
  matched: boolean;
};

export type RankedMatchCandidate = {
  technician_id: string;
  technician_name: string;
  request_id: number;
  execution_id: string;
  branch: string;
  city: string;
  custody_state: string;
  installation_status: string;
  score: number;
  confidence: number;
  evidence_score: number;
  ambiguity_score: number;
  confidence_band: MatchConfidenceBand;
  matched_reason: string[];
  rejected_reason: string[];
  signals: MatchSignalHit[];
};

export type AmbiguityMeta = {
  multiple_technicians: boolean;
  multiple_requests: boolean;
  conflicting_branches: boolean;
  duplicate_serial: boolean;
  multiple_custody_owners: boolean;
  codes: string[];
  messages: string[];
};

export type MatchingProvenance = {
  matching_engine_version: typeof MATCHING_ENGINE_VERSION;
  runtime_version: typeof MATCHING_RUNTIME_VERSION;
  ranking_strategy: typeof RANKING_STRATEGY;
  extraction_session_id: string;
  extraction_attempt_id: string;
  graph_version: string;
  document_id: string;
  device_id: string;
  processing_time_ms: number;
  matched_at: string;
};

export type DeviceMatchingResult = {
  device_id: string;
  keys: DeviceMatchKeys;
  candidates: RankedMatchCandidate[];
  best: RankedMatchCandidate | null;
  ambiguity: AmbiguityMeta;
  provenance: MatchingProvenance;
  /** Human-readable checklist for Review (no raw weights). */
  explanation: string[];
};

export type MatchingRuntimeRequest = {
  device_graph: import("../domain/types.js").DeviceGraph;
  device_id?: string; // if omitted, match all devices
};

export type MatchingRuntimeResponse = {
  results: DeviceMatchingResult[];
  ranking_strategy: typeof RANKING_STRATEGY;
};

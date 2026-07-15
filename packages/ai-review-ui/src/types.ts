/** View models for AI Review Workspace — aligned with AI Engine contracts, UI-only. */

/** Normalized page-relative box (0–1). Present only when Vision coords exist. */
export type FieldBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ConfidenceFieldView = {
  key: string;
  label: string;
  value: string | null;
  confidence: number;
  /** Page/image ids linked for highlight */
  source_image_ids: string[];
  /** Optional field location on the linked image */
  bbox?: FieldBBox;
};

export type DeviceRowView = {
  device_id: string;
  device_index: number;
  status: string;
  serial_number: string | null;
  sim_serial: string | null;
  tid: string | null;
  merchant: string | null;
  branch: string | null;
  image_count: number;
  extraction_confidence: number;
  match_confidence: number;
  fields: ConfidenceFieldView[];
};

export type PageView = {
  page: number;
  label: string;
  /** CSS placeholder color / pattern key — fixtures only */
  preview_tone: string;
  image_id: string;
  quality_score: number;
};

export type CandidateView = {
  technician_id: string;
  technician_name: string;
  request_id: number;
  execution_id: string;
  branch: string;
  city: string;
  custody_state: string;
  installation_status: string;
  confidence: number;
  confidence_band: string;
  matched_reason: string[];
  rejected_reason: string[];
};

export type GraphNodeView = {
  id: string;
  kind: string;
  label: string;
  device_id?: string;
};

export type GraphEdgeView = {
  id: string;
  from: string;
  to: string;
  type: string;
};

export type ReviewVersionView = {
  review_version: number;
  device_id: string;
  edited_by: string;
  edited_at: string;
  reason?: string;
  field_diffs: Array<{ field: string; before: unknown; after: unknown }>;
};

export type AttemptOption = {
  extraction_attempt_id: string;
  label: string;
  status: string;
};

export type SessionOption = {
  extraction_session_id: string;
  label: string;
  attempts: AttemptOption[];
};

export type AiReviewWorkspaceFixture = {
  document_id: string;
  document_label: string;
  sessions: SessionOption[];
  active_session_id: string;
  active_attempt_id: string;
  pages: PageView[];
  devices: DeviceRowView[];
  candidates_by_device: Record<string, CandidateView[]>;
  explanation_by_device: Record<string, string[]>;
  graph_nodes: GraphNodeView[];
  graph_edges: GraphEdgeView[];
  review_history: ReviewVersionView[];
};

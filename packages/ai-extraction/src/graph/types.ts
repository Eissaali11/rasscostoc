import type { DeviceGraph, DeviceStatus, ImageRef } from "../domain/types.js";
import type { DeviceVisionExtraction } from "../vision/types.js";

export type GraphDeviceInput = {
  device_id: string;
  device_index: number;
  grouping_confidence: number;
  images: ImageRef[];
  vision?: DeviceVisionExtraction;
  force_review?: boolean;
};

export type GraphBuildRequest = {
  document_id: string;
  document_type: string;
  extraction_session_id: string;
  extraction_attempt_id: string;
  devices: GraphDeviceInput[];
};

export type RelationshipIssue = {
  code:
    | "INTERNAL_CONFLICT"
    | "CROSS_DEVICE_DUPLICATE"
    | "LOW_CONFIDENCE_IDENTIFIER"
    | "VISION_FAILED"
    | "MERGE_REJECTED";
  severity: "error" | "warning";
  device_ids: string[];
  message: string;
  fields?: string[];
};

export type MergeDecision = {
  left_device_id: string;
  right_device_id: string;
  decision: "keep_separate" | "merge_candidate";
  reason: string;
  /** Always false in PR-006A-5 — merges are never applied automatically */
  applied: false;
};

export type MatchingPrepDevice = {
  device_id: string;
  status: DeviceStatus;
  serial_number?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  merchant?: string | null;
  branch?: string | null;
  ready_for_matching: boolean;
  blockers: string[];
};

export type GraphBuildResult = {
  graph: DeviceGraph;
  issues: RelationshipIssue[];
  merge_decisions: MergeDecision[];
  matching_prep: MatchingPrepDevice[];
  provenance: {
    pipeline_version: "graph_runtime_v1";
    document_id: string;
    extraction_session_id: string;
    extraction_attempt_id: string;
    document_type: string;
    device_count: number;
    built_at: string;
    engine_version: "006A";
  };
};

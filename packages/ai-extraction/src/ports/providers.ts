import type {
  DeviceGraph,
  ImageRef,
  MatchResult,
  RegistryBundle,
  ValidationIssue,
  BusinessRuleIssue,
} from "../domain/types.js";

export interface DocumentTypeClassifier {
  classify(input: {
    document_id: string;
    sample: unknown;
  }): Promise<{
    document_type: string;
    document_type_confidence: number;
    registry_bundle_id: string;
    prompt_profile: string;
    schema_profile: string;
  }>;
}

export interface DeviceGroupingProvider {
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

export type VisionExtractResult =
  | { ok: true; json: Record<string, unknown> }
  | {
      ok: false;
      code: "invalid_json" | "timeout" | "disabled" | "provider_error";
      message: string;
    };

export type VisionProviderInput = {
  device_id: string;
  document_type: string;
  schema_version: string;
  prompt_version: string;
  images: ImageRef[];
  temperature?: number;
  image_payloads?: Array<{
    image_id?: string;
    mime_type: string;
    base64: string;
  }>;
  response_schema?: Record<string, unknown>;
  system_prompt?: string;
};

export interface VisionProvider {
  extractDevice(input: VisionProviderInput): Promise<VisionExtractResult>;
}

/** Domain engine — not a Vision-style AI provider. Runtime matching deferred (006C). */
export interface MatchingEngine {
  match(input: {
    device_graph: DeviceGraph;
    device_id: string;
    ranking_strategy: string;
  }): Promise<MatchResult>;
}

export interface ExtractionSchemaRegistry {
  resolve(bundle_id: string): RegistryBundle;
  /** Published bundles are immutable — publish creates a new id/version only. */
  publish(bundle: Omit<RegistryBundle, "immutable" | "published_at"> & {
    published_at?: string;
  }): RegistryBundle;
  list(): RegistryBundle[];
}

export interface ValidationRulesEngine {
  validate(graph: DeviceGraph, rules_version: string): ValidationIssue[];
}

/** Contract reserved — runtime primarily 006C/006G. */
export interface BusinessRuleEngine {
  evaluate(graph: DeviceGraph, rules_version: string): BusinessRuleIssue[];
}

/** Stub Vision — disabled by default (no accidental live calls). */
export class DisabledVisionProvider implements VisionProvider {
  readonly id = "disabled_vision";
  async extractDevice(_input: VisionProviderInput): Promise<VisionExtractResult> {
    void _input;
    return {
      ok: false,
      code: "disabled",
      message: "Vision provider disabled (no live Gemini unless GeminiVisionAdapter allowLive=true)",
    };
  }
}

/** Stub Matching — explicit unmatched, never fake 100%. */
export class StubMatchingEngine implements MatchingEngine {
  async match(input: {
    device_graph: DeviceGraph;
    device_id: string;
    ranking_strategy: string;
  }): Promise<MatchResult> {
    void input.device_graph;
    return {
      matched_by: null,
      match_confidence: 0,
      matched_reason: [],
      mismatch_reason: "matching_deferred_to_006C",
      ranking_strategy: input.ranking_strategy,
    };
  }
}

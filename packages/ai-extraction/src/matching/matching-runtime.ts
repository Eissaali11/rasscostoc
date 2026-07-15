import type { DeviceGraph, MatchResult } from "../domain/types.js";
import type { MatchingEngine } from "../ports/providers.js";
import { detectAmbiguity } from "./ambiguity.js";
import { runCascadeSearch } from "./cascade.js";
import { buildExplanation } from "./explainability.js";
import { extractMatchKeysFromGraph, listDeviceIds } from "./extract-keys.js";
import { rankCandidates } from "./ranking.js";
import type { MatchingDataPorts } from "./repositories.js";
import {
  MATCHING_ENGINE_VERSION,
  MATCHING_RUNTIME_VERSION,
  RANKING_STRATEGY,
  type DeviceMatchingResult,
  type MatchingRuntimeRequest,
  type MatchingRuntimeResponse,
} from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Technician Matching Runtime — read-only against fixture/in-memory ports.
 * Consumes Canonical Device Graph only. Never writes Courier / Apply.
 */
export class TechnicianMatchingRuntime {
  readonly id = MATCHING_RUNTIME_VERSION;

  constructor(private readonly ports: MatchingDataPorts) {}

  async match(request: MatchingRuntimeRequest): Promise<MatchingRuntimeResponse> {
    const graph = request.device_graph;
    const deviceIds = request.device_id
      ? [request.device_id]
      : listDeviceIds(graph);

    const results: DeviceMatchingResult[] = [];
    for (const device_id of deviceIds) {
      results.push(await this.matchDevice(graph, device_id));
    }

    return { results, ranking_strategy: RANKING_STRATEGY };
  }

  private async matchDevice(
    graph: DeviceGraph,
    device_id: string,
  ): Promise<DeviceMatchingResult> {
    const started = Date.now();
    const keys = extractMatchKeysFromGraph(graph, device_id);
    const acc = await runCascadeSearch(keys, this.ports);
    let candidates = rankCandidates(acc, keys);
    const ambiguity = detectAmbiguity(candidates);

    // If ambiguous, force review band on top candidates (do not auto-resolve)
    if (ambiguity.codes.length > 0 && candidates[0]) {
      candidates = candidates.map((c, i) =>
        i === 0 || c.confidence >= 80
          ? {
              ...c,
              confidence_band:
                c.confidence_band === "auto_match_candidate"
                  ? "recommended_review"
                  : c.confidence_band,
            }
          : c,
      );
    }

    const best = candidates[0] ?? null;
    const processing_time_ms = Date.now() - started;

    return {
      device_id,
      keys,
      candidates,
      best,
      ambiguity,
      explanation: buildExplanation(best),
      provenance: {
        matching_engine_version: MATCHING_ENGINE_VERSION,
        runtime_version: MATCHING_RUNTIME_VERSION,
        ranking_strategy: RANKING_STRATEGY,
        extraction_session_id: graph.extraction_session_id,
        extraction_attempt_id: graph.extraction_attempt_id,
        graph_version: graph.graph_version,
        document_id: graph.document_id,
        device_id,
        processing_time_ms,
        matched_at: nowIso(),
      },
    };
  }
}

/** Adapter implementing MatchingEngine port from PR-006A-1 contracts. */
export class GraphMatchingEngine implements MatchingEngine {
  constructor(private readonly runtime: TechnicianMatchingRuntime) {}

  async match(input: {
    device_graph: DeviceGraph;
    device_id: string;
    ranking_strategy: string;
  }): Promise<MatchResult> {
    const { results } = await this.runtime.match({
      device_graph: input.device_graph,
      device_id: input.device_id,
    });
    const device = results[0];
    const best = device?.best;
    if (!best) {
      return {
        matched_by: null,
        match_confidence: 0,
        matched_reason: [],
        mismatch_reason: "no_candidates",
        ranking_strategy: input.ranking_strategy || RANKING_STRATEGY,
      };
    }
    return {
      technician: { id: best.technician_id, name: best.technician_name },
      city: best.city,
      branch: best.branch,
      request_id: best.request_id,
      custody_status: best.custody_state,
      installation_status: best.installation_status,
      matched_by: best.signals[0]?.signal ?? "cascade",
      match_confidence: best.confidence,
      matched_reason: best.matched_reason,
      mismatch_reason:
        device.ambiguity.codes.length > 0 ? device.ambiguity.messages.join("; ") : null,
      ranking_strategy: RANKING_STRATEGY,
    };
  }
}

import { computeDeviceFingerprint } from "../domain/fingerprint.js";
import {
  assertDeviceGraphContract,
  createEmptyDeviceGraph,
  summarizeDevicesFromGraph,
} from "../domain/device-graph.js";
import { nowIso } from "../domain/ids.js";
import type {
  CommercialNode,
  DeviceGraph,
  DeviceNode,
  DeviceStatus,
  IdentifierNode,
  ImageNode,
  ImageRef,
} from "../domain/types.js";
import { evaluateMergeRules } from "./merge-rules.js";
import { prepareForMatching } from "./matching-prep.js";
import { RelationshipEngine } from "./relationship-engine.js";
import type {
  GraphBuildRequest,
  GraphBuildResult,
  RelationshipIssue,
} from "./types.js";

/**
 * Canonical Device Graph Runtime — Vision results → Graph + relationships + matching prep.
 * Never auto-merges devices. On doubt: separate + Review.
 */
export class CanonicalDeviceGraphBuilder {
  readonly id = "canonical_device_graph_builder_v1";
  private readonly relationships = new RelationshipEngine();

  build(request: GraphBuildRequest): GraphBuildResult {
    let graph = createEmptyDeviceGraph({
      extraction_session_id: request.extraction_session_id,
      extraction_attempt_id: request.extraction_attempt_id,
      document_id: request.document_id,
      document_type: request.document_type,
    });

    const issues: RelationshipIssue[] = [];
    const mergeProbes: Array<{
      device_id: string;
      serial_number?: { value: string | null; confidence: number };
      sim_serial?: { value: string | null; confidence: number };
      tid?: { value: string | null; confidence: number };
    }> = [];

    for (const device of request.devices) {
      const vision = device.vision;
      const visionFailed = !vision || !vision.ok || !vision.schema_valid;

      if (visionFailed) {
        issues.push({
          code: "VISION_FAILED",
          severity: "error",
          device_ids: [device.device_id],
          message: vision?.error?.message ?? "Vision extraction missing or invalid",
        });
      }

      const fields = vision?.fields ?? {};
      const sn = fields.serial_number;
      const sim = fields.sim_serial;
      const tid = fields.tid;
      const merchant = fields.merchant;
      const branch = fields.branch;
      const model = fields.model;
      const manufacturer = fields.manufacturer;

      const fingerprint = computeDeviceFingerprint({
        document_type: request.document_type,
        serial_number: sn?.value,
        sim_serial: sim?.value,
        tid: tid?.value,
        merchant: merchant?.value,
        branch: branch?.value,
        model: model?.value,
        manufacturer: manufacturer?.value,
      });

      let status: DeviceStatus = "Ready";
      if (visionFailed || device.force_review) status = visionFailed ? "Failed" : "Review";
      if (!visionFailed && (vision?.extraction_confidence ?? 100) < 50) status = "Review";

      const deviceNode: DeviceNode = {
        kind: "device",
        id: device.device_id,
        device_id: device.device_id,
        device_index: device.device_index,
        status,
        grouping_confidence: device.grouping_confidence,
        extraction_confidence: vision?.extraction_confidence,
        device_fingerprint: fingerprint.device_fingerprint,
        fingerprint_version: fingerprint.fingerprint_version,
      };

      const imageNodes: ImageNode[] = device.images.map((img, i) =>
        toImageNode(device.device_id, img, i),
      );

      const identNodes: IdentifierNode[] = [];
      const commercialNodes: CommercialNode[] = [];
      const edges = [];

      for (const img of imageNodes) {
        edges.push({
          id: `edge:belongs:${img.id}`,
          type: "belongs_to_device" as const,
          from: img.id,
          to: device.device_id,
        });
        if (vision?.ok) {
          edges.push({
            id: `edge:extracted:${img.id}`,
            type: "extracted_from" as const,
            from: device.device_id,
            to: img.id,
            meta: {
              provider_id: vision.provider_id,
              schema_version: vision.schema_version,
              prompt_version: vision.prompt_version,
              extraction_attempt_id: request.extraction_attempt_id,
            },
          });
        }
      }

      if (sn) {
        const id = `${device.device_id}:id:serial_number`;
        identNodes.push({
          kind: "identifier",
          id,
          device_id: device.device_id,
          id_type: "serial_number",
          value: sn.value,
          confidence: sn.confidence,
        });
      }
      if (sim) {
        identNodes.push({
          kind: "identifier",
          id: `${device.device_id}:id:sim_serial`,
          device_id: device.device_id,
          id_type: "sim_serial",
          value: sim.value,
          confidence: sim.confidence,
        });
      }
      if (tid) {
        identNodes.push({
          kind: "identifier",
          id: `${device.device_id}:id:tid`,
          device_id: device.device_id,
          id_type: "tid",
          value: tid.value,
          confidence: tid.confidence,
        });
      }
      if (merchant) {
        commercialNodes.push({
          kind: "commercial",
          id: `${device.device_id}:com:merchant`,
          device_id: device.device_id,
          field: "merchant",
          value: merchant.value,
          confidence: merchant.confidence,
        });
      }
      if (branch) {
        commercialNodes.push({
          kind: "commercial",
          id: `${device.device_id}:com:branch`,
          device_id: device.device_id,
          field: "branch",
          value: branch.value,
          confidence: branch.confidence,
        });
      }
      if (model) {
        commercialNodes.push({
          kind: "commercial",
          id: `${device.device_id}:com:model`,
          device_id: device.device_id,
          field: "model",
          value: model.value,
          confidence: model.confidence,
        });
      }
      if (manufacturer) {
        commercialNodes.push({
          kind: "commercial",
          id: `${device.device_id}:com:manufacturer`,
          device_id: device.device_id,
          field: "manufacturer",
          value: manufacturer.value,
          confidence: manufacturer.confidence,
        });
      }

      graph = {
        ...graph,
        nodes: [
          ...graph.nodes,
          deviceNode,
          ...imageNodes,
          ...identNodes,
          ...commercialNodes,
        ],
        edges: [...graph.edges, ...edges],
      };

      mergeProbes.push({
        device_id: device.device_id,
        serial_number: sn,
        sim_serial: sim,
        tid,
      });
    }

    const merge_decisions = evaluateMergeRules(mergeProbes);
    for (const d of merge_decisions) {
      if (d.decision === "merge_candidate") {
        issues.push({
          code: "MERGE_REJECTED",
          severity: "warning",
          device_ids: [d.left_device_id, d.right_device_id],
          message: d.reason,
        });
        // Force Review on both — do not merge
        graph = {
          ...graph,
          nodes: graph.nodes.map((n) =>
            n.kind === "device" &&
            (n.device_id === d.left_device_id || n.device_id === d.right_device_id) &&
            n.status === "Ready"
              ? { ...n, status: "Review" as const }
              : n,
          ),
        };
      }
    }

    const related = this.relationships.apply(graph);
    graph = related.graph;
    issues.push(...related.issues);

    const prepared = prepareForMatching(graph, issues);
    graph = prepared.graph;

    assertDeviceGraphContract(graph);

    return {
      graph,
      issues,
      merge_decisions,
      matching_prep: prepared.matching_prep,
      provenance: {
        pipeline_version: "graph_runtime_v1",
        document_id: request.document_id,
        extraction_session_id: request.extraction_session_id,
        extraction_attempt_id: request.extraction_attempt_id,
        document_type: request.document_type,
        device_count: request.devices.length,
        built_at: nowIso(),
        engine_version: "006A",
      },
    };
  }
}

function toImageNode(device_id: string, img: ImageRef, index: number): ImageNode {
  return {
    kind: "image",
    id: img.image_id ?? `${device_id}:img:${index + 1}`,
    device_id,
    page: img.page,
    region_id: img.region_id,
    quality_score: img.quality_score,
  };
}

/** Convenience: summaries remain derived from Graph only. */
export function graphToSummaries(graph: DeviceGraph) {
  return summarizeDevicesFromGraph(graph);
}

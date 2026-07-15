import type {
  CommercialNode,
  ConfidenceField,
  DeviceGraph,
  DeviceNode,
  DeviceSummary,
  IdentifierNode,
  ImageNode,
  ImageRef,
  MatchCandidateNode,
  MatchResult,
} from "./types.js";

export function createEmptyDeviceGraph(args: {
  extraction_session_id: string;
  extraction_attempt_id: string;
  document_id: string;
  document_type: string;
}): DeviceGraph {
  return {
    graph_version: "device_graph_v1",
    extraction_session_id: args.extraction_session_id,
    extraction_attempt_id: args.extraction_attempt_id,
    document_id: args.document_id,
    document_type: args.document_type,
    nodes: [],
    edges: [],
  };
}

export function assertDeviceGraphContract(graph: DeviceGraph): void {
  if (graph.graph_version !== "device_graph_v1") {
    throw new Error(`Unsupported graph_version: ${graph.graph_version}`);
  }
  for (const node of graph.nodes) {
    if (node.kind === "image" && (node.quality_score < 0 || node.quality_score > 100)) {
      throw new Error(`Invalid quality_score on image ${node.id}`);
    }
  }
}

function identifierField(
  nodes: IdentifierNode[],
  idType: IdentifierNode["id_type"],
): ConfidenceField | undefined {
  const hit = nodes.find((n) => n.id_type === idType);
  if (!hit) return undefined;
  return { value: hit.value, confidence: hit.confidence };
}

function commercialField(
  nodes: CommercialNode[],
  field: CommercialNode["field"],
): ConfidenceField | undefined {
  const hit = nodes.find((n) => n.field === field);
  if (!hit) return undefined;
  return { value: hit.value, confidence: hit.confidence };
}

/** Derive denormalized DeviceSummary[] from Graph — Graph remains source of truth. */
export function summarizeDevicesFromGraph(graph: DeviceGraph): DeviceSummary[] {
  assertDeviceGraphContract(graph);
  const devices = graph.nodes.filter((n): n is DeviceNode => n.kind === "device");
  return devices
    .slice()
    .sort((a, b) => a.device_index - b.device_index)
    .map((device) => {
      const idents = graph.nodes.filter(
        (n): n is IdentifierNode => n.kind === "identifier" && n.device_id === device.device_id,
      );
      const commercials = graph.nodes.filter(
        (n): n is CommercialNode => n.kind === "commercial" && n.device_id === device.device_id,
      );
      const images: ImageRef[] = graph.nodes
        .filter((n): n is ImageNode => n.kind === "image" && n.device_id === device.device_id)
        .map((img) => ({
          page: img.page,
          region_id: img.region_id,
          quality_score: img.quality_score,
        }));
      const matchNode = graph.nodes.find(
        (n): n is MatchCandidateNode =>
          n.kind === "match_candidate" && n.device_id === device.device_id,
      );
      const match: MatchResult | undefined = matchNode
        ? {
            technician: matchNode.technician_id
              ? { id: matchNode.technician_id }
              : undefined,
            request_id: matchNode.request_id,
            matched_by: matchNode.matched_by ?? null,
            match_confidence: matchNode.match_confidence ?? 0,
            matched_reason: matchNode.matched_reason ?? [],
            mismatch_reason: matchNode.mismatch_reason ?? null,
            ranking_strategy: matchNode.ranking_strategy,
          }
        : undefined;

      return {
        device_id: device.device_id,
        device_index: device.device_index,
        device_fingerprint: device.device_fingerprint,
        images,
        serial_number: identifierField(idents, "serial_number"),
        sim_serial: identifierField(idents, "sim_serial"),
        tid: identifierField(idents, "tid"),
        merchant: commercialField(commercials, "merchant"),
        branch: commercialField(commercials, "branch"),
        model: commercialField(commercials, "model"),
        manufacturer: commercialField(commercials, "manufacturer"),
        extraction_confidence: device.extraction_confidence,
        grouping_confidence: device.grouping_confidence,
        status: device.status,
        match,
        provenance: {
          device_id: device.device_id,
          grouping_confidence: device.grouping_confidence,
          extraction_confidence: device.extraction_confidence,
          matching_confidence: device.matching_confidence,
          fingerprint_version: device.fingerprint_version,
          engine_version: "006A",
        },
      };
    });
}

export function addDeviceWithImages(
  graph: DeviceGraph,
  args: {
    device_id: string;
    device_index: number;
    grouping_confidence: number;
    status?: DeviceNode["status"];
    images: ImageRef[];
    fingerprint?: { device_fingerprint: string; fingerprint_version: string };
  },
): DeviceGraph {
  const deviceNode: DeviceNode = {
    kind: "device",
    id: args.device_id,
    device_id: args.device_id,
    device_index: args.device_index,
    status: args.status ?? "Review",
    grouping_confidence: args.grouping_confidence,
    device_fingerprint: args.fingerprint?.device_fingerprint,
    fingerprint_version: args.fingerprint?.fingerprint_version,
  };
  const imageNodes: ImageNode[] = args.images.map((img, i) => ({
    kind: "image",
    id: `${args.device_id}:img:${i + 1}`,
    device_id: args.device_id,
    page: img.page,
    region_id: img.region_id,
    quality_score: img.quality_score,
  }));
  const edges = imageNodes.map((img) => ({
    id: `edge:${args.device_id}:${img.id}`,
    type: "belongs_to_device" as const,
    from: img.id,
    to: args.device_id,
  }));
  return {
    ...graph,
    nodes: [...graph.nodes, deviceNode, ...imageNodes],
    edges: [...graph.edges, ...edges],
  };
}

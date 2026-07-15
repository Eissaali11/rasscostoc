import type {
  CommercialNode,
  DeviceGraph,
  DeviceGraphEdge,
  DeviceNode,
  IdentifierNode,
} from "../domain/types.js";
import type { RelationshipIssue } from "./types.js";

function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

/**
 * Relationship Engine: bind SN ↔ SIM ↔ TID ↔ Merchant ↔ Branch within each device,
 * detect internal conflicts and cross-device duplicates.
 * Never collapses device_ids.
 */
export class RelationshipEngine {
  readonly id = "relationship_engine_v1";

  apply(graph: DeviceGraph): { graph: DeviceGraph; issues: RelationshipIssue[] } {
    const issues: RelationshipIssue[] = [];
    let nodes = [...graph.nodes];
    let edges = [...graph.edges];

    const devices = nodes.filter((n): n is DeviceNode => n.kind === "device");

    for (const device of devices) {
      const idents = nodes.filter(
        (n): n is IdentifierNode => n.kind === "identifier" && n.device_id === device.device_id,
      );
      const commercials = nodes.filter(
        (n): n is CommercialNode => n.kind === "commercial" && n.device_id === device.device_id,
      );

      // Internal duplicate id_types with different values
      for (const idType of ["serial_number", "sim_serial", "tid"] as const) {
        const same = idents.filter((i) => i.id_type === idType && norm(i.value));
        const values = new Set(same.map((i) => norm(i.value)));
        if (values.size > 1) {
          issues.push({
            code: "INTERNAL_CONFLICT",
            severity: "error",
            device_ids: [device.device_id],
            fields: [idType],
            message: `Conflicting ${idType} values on ${device.device_id}`,
          });
          for (let i = 0; i < same.length; i++) {
            for (let j = i + 1; j < same.length; j++) {
              edges.push({
                id: `edge:conflict:${same[i]!.id}:${same[j]!.id}`,
                type: "conflicts_with",
                from: same[i]!.id,
                to: same[j]!.id,
                meta: { field: idType },
              });
            }
          }
          nodes = markDeviceReview(nodes, device.device_id);
        }
      }

      // Bind co-located relationships among primary identifiers + commercial
      const sn = idents.find((i) => i.id_type === "serial_number" && norm(i.value));
      const sim = idents.find((i) => i.id_type === "sim_serial" && norm(i.value));
      const tid = idents.find((i) => i.id_type === "tid" && norm(i.value));
      const merchant = commercials.find((c) => c.field === "merchant" && norm(c.value));
      const branch = commercials.find((c) => c.field === "branch" && norm(c.value));

      const chain = [sn, sim, tid, merchant, branch].filter(Boolean) as Array<
        IdentifierNode | CommercialNode
      >;
      for (let i = 0; i < chain.length; i++) {
        for (let j = i + 1; j < chain.length; j++) {
          edges.push({
            id: `edge:rel:${chain[i]!.id}:${chain[j]!.id}`,
            type: "co_located_on_page",
            from: chain[i]!.id,
            to: chain[j]!.id,
            meta: { relationship: "device_bundle", device_id: device.device_id },
          });
        }
      }

      for (const ident of idents) {
        if (ident.value && ident.confidence > 0 && ident.confidence < 40) {
          issues.push({
            code: "LOW_CONFIDENCE_IDENTIFIER",
            severity: "warning",
            device_ids: [device.device_id],
            fields: [ident.id_type],
            message: `Low confidence ${ident.id_type} on ${device.device_id}`,
          });
          nodes = markDeviceReview(nodes, device.device_id);
        }
      }
    }

    // Cross-device duplicate SN / TID / SIM
    for (const idType of ["serial_number", "sim_serial", "tid"] as const) {
      const byValue = new Map<string, IdentifierNode[]>();
      for (const n of nodes) {
        if (n.kind !== "identifier" || n.id_type !== idType) continue;
        const v = norm(n.value);
        if (!v) continue;
        const list = byValue.get(v) ?? [];
        list.push(n);
        byValue.set(v, list);
      }
      for (const [value, list] of byValue) {
        const deviceIds = [...new Set(list.map((l) => l.device_id))];
        if (deviceIds.length < 2) continue;
        issues.push({
          code: "CROSS_DEVICE_DUPLICATE",
          severity: "error",
          device_ids: deviceIds,
          fields: [idType],
          message: `Duplicate ${idType}=${value} across ${deviceIds.join(", ")} — keep separate + Review`,
        });
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            if (list[i]!.device_id === list[j]!.device_id) continue;
            edges.push({
              id: `edge:dup:${list[i]!.id}:${list[j]!.id}`,
              type: "conflicts_with",
              from: list[i]!.id,
              to: list[j]!.id,
              meta: { field: idType, value, duplicate: true },
            });
          }
        }
        for (const id of deviceIds) {
          nodes = markDeviceReview(nodes, id);
        }
      }
    }

    return {
      graph: { ...graph, nodes, edges },
      issues,
    };
  }
}

function markDeviceReview(
  nodes: DeviceGraph["nodes"],
  device_id: string,
): DeviceGraph["nodes"] {
  return nodes.map((n) => {
    if (n.kind === "device" && n.device_id === device_id && n.status === "Ready") {
      return { ...n, status: "Review" as const };
    }
    return n;
  });
}

export function listConflictEdges(graph: DeviceGraph): DeviceGraphEdge[] {
  return graph.edges.filter((e) => e.type === "conflicts_with");
}

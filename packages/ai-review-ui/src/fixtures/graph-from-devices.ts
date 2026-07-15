import type { DeviceRowView, GraphEdgeView, GraphNodeView } from "../types.js";

/** Build a readable SN ↔ SIM ↔ TID ↔ Merchant ↔ Branch graph per device. */
export function graphFromDevices(
  devices: DeviceRowView[],
  opts?: { conflictPairs?: Array<[string, string]> },
): { graph_nodes: GraphNodeView[]; graph_edges: GraphEdgeView[] } {
  const graph_nodes: GraphNodeView[] = [];
  const graph_edges: GraphEdgeView[] = [];

  for (const d of devices) {
    const deviceNode = { id: d.device_id, kind: "device", label: d.device_id, device_id: d.device_id };
    graph_nodes.push(deviceNode);

    const links: Array<{ kind: string; key: string; label: string | null }> = [
      { kind: "sn", key: "serial_number", label: d.serial_number },
      { kind: "sim", key: "sim_serial", label: d.sim_serial },
      { kind: "tid", key: "tid", label: d.tid },
      { kind: "merchant", key: "merchant", label: d.merchant },
      { kind: "branch", key: "branch", label: d.branch },
    ];

    const present: string[] = [];
    for (const link of links) {
      if (!link.label) continue;
      const id = `${d.device_id}:${link.key}`;
      present.push(id);
      graph_nodes.push({
        id,
        kind: link.kind,
        label: link.label,
        device_id: d.device_id,
      });
      graph_edges.push({
        id: `e-${d.device_id}-${link.key}`,
        from: d.device_id,
        to: id,
        type: "belongs_to_device",
      });
    }

    // Chain identifiers for non-technical readability: SN → SIM → TID → Merchant → Branch
    for (let i = 0; i < present.length - 1; i++) {
      graph_edges.push({
        id: `e-chain-${d.device_id}-${i}`,
        from: present[i]!,
        to: present[i + 1]!,
        type: "related_to",
      });
    }
  }

  for (const [a, b] of opts?.conflictPairs ?? []) {
    graph_edges.push({
      id: `e-conflict-${a}-${b}`,
      from: a,
      to: b,
      type: "conflicts_with",
    });
  }

  return { graph_nodes, graph_edges };
}

import type { DeviceGraph, MatchCandidateNode } from "../domain/types.js";
import type { MatchingPrepDevice, RelationshipIssue } from "./types.js";

/**
 * Prepare Graph for Matching Engine (later) without running Matching.
 * Adds unmatched match_candidate stubs; reports readiness blockers.
 */
export function prepareForMatching(
  graph: DeviceGraph,
  issues: RelationshipIssue[],
): { graph: DeviceGraph; matching_prep: MatchingPrepDevice[] } {
  const devices = graph.nodes.filter((n) => n.kind === "device");
  let nodes = [...graph.nodes];
  const matching_prep: MatchingPrepDevice[] = [];

  for (const device of devices) {
    if (device.kind !== "device") continue;
    const idents = graph.nodes.filter(
      (n) => n.kind === "identifier" && n.device_id === device.device_id,
    );
    const commercials = graph.nodes.filter(
      (n) => n.kind === "commercial" && n.device_id === device.device_id,
    );

    const sn = idents.find((n) => n.kind === "identifier" && n.id_type === "serial_number");
    const sim = idents.find((n) => n.kind === "identifier" && n.id_type === "sim_serial");
    const tid = idents.find((n) => n.kind === "identifier" && n.id_type === "tid");
    const merchant = commercials.find((n) => n.kind === "commercial" && n.field === "merchant");
    const branch = commercials.find((n) => n.kind === "commercial" && n.field === "branch");

    const blockers: string[] = [];
    if (device.status === "Failed" || device.status === "ValidationFailed") {
      blockers.push(`status_${device.status}`);
    }
    if (issues.some((i) => i.device_ids.includes(device.device_id) && i.severity === "error")) {
      blockers.push("relationship_error");
    }
    const hasKey =
      (sn && sn.kind === "identifier" && sn.value) ||
      (sim && sim.kind === "identifier" && sim.value) ||
      (tid && tid.kind === "identifier" && tid.value);
    if (!hasKey) blockers.push("no_match_key");

    const ready = blockers.length === 0 && device.status !== "Failed";
    const status = device.status === "Ready" && !ready ? ("Unmatched" as const) : device.status;

    if (!nodes.some((n) => n.kind === "match_candidate" && n.device_id === device.device_id)) {
      const candidate: MatchCandidateNode = {
        kind: "match_candidate",
        id: `match:${device.device_id}`,
        device_id: device.device_id,
        match_confidence: 0,
        matched_reason: [],
        mismatch_reason: ready
          ? "awaiting_matching_engine"
          : `not_ready: ${blockers.join(",")}`,
      };
      nodes.push(candidate);
    }

    nodes = nodes.map((n) =>
      n.kind === "device" && n.device_id === device.device_id ? { ...n, status } : n,
    );

    matching_prep.push({
      device_id: device.device_id,
      status,
      serial_number: sn && sn.kind === "identifier" ? sn.value : null,
      sim_serial: sim && sim.kind === "identifier" ? sim.value : null,
      tid: tid && tid.kind === "identifier" ? tid.value : null,
      merchant: merchant && merchant.kind === "commercial" ? merchant.value : null,
      branch: branch && branch.kind === "commercial" ? branch.value : null,
      ready_for_matching: ready,
      blockers,
    });
  }

  return { graph: { ...graph, nodes }, matching_prep };
}

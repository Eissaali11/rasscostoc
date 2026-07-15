import type { DeviceGraph } from "../domain/types.js";
import type { DeviceMatchKeys } from "./types.js";

function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

/** Pull match keys for a device from Canonical Device Graph only. */
export function extractMatchKeysFromGraph(
  graph: DeviceGraph,
  device_id: string,
): DeviceMatchKeys {
  const idents = graph.nodes.filter(
    (n) => n.kind === "identifier" && n.device_id === device_id,
  );
  const commercials = graph.nodes.filter(
    (n) => n.kind === "commercial" && n.device_id === device_id,
  );

  const pickId = (id_type: string) => {
    const n = idents.find((i) => i.kind === "identifier" && i.id_type === id_type);
    return n && n.kind === "identifier" ? norm(n.value) : null;
  };
  const pickCom = (field: string) => {
    const n = commercials.find((c) => c.kind === "commercial" && c.field === field);
    return n && n.kind === "commercial" ? norm(n.value) : null;
  };

  return {
    device_id,
    serial_number: pickId("serial_number"),
    sim_serial: pickId("sim_serial"),
    tid: pickId("tid"),
    mobile: pickId("mobile"),
    merchant: pickCom("merchant"),
    branch: pickCom("branch"),
    city: pickCom("city"),
    incident: null, // optional; may be supplied via commercial "other" later — keep null unless present
  };
}

export function listDeviceIds(graph: DeviceGraph): string[] {
  return graph.nodes
    .filter((n) => n.kind === "device")
    .map((n) => (n.kind === "device" ? n.device_id : ""))
    .filter(Boolean)
    .sort();
}

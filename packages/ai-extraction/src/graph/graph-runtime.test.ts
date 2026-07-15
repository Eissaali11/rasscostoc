import { describe, expect, it } from "vitest";
import {
  CanonicalDeviceGraphBuilder,
  evaluateMergeRules,
  listConflictEdges,
  summarizeDevicesFromGraph,
} from "../index.js";
import type { DeviceVisionExtraction } from "../vision/types.js";

function visionOk(
  device_id: string,
  fields: DeviceVisionExtraction["fields"],
): DeviceVisionExtraction {
  return {
    device_id,
    ok: true,
    schema_valid: true,
    schema_version: "schema_v3",
    prompt_version: "prompt_v2",
    provider_id: "fixture_vision_v1",
    fields,
    extraction_confidence: 90,
    schema_errors: [],
  };
}

describe("PR-006A-5 Canonical Device Graph Runtime", () => {
  const builder = new CanonicalDeviceGraphBuilder();

  it("converts Vision fields into graph nodes with attempt provenance", () => {
    const result = builder.build({
      document_id: "doc-g1",
      document_type: "installation_report",
      extraction_session_id: "extract_20260714_000001",
      extraction_attempt_id: "attempt_1",
      devices: [
        {
          device_id: "device-1",
          device_index: 1,
          grouping_confidence: 92,
          images: [{ page: 1, quality_score: 95, image_id: "img:doc-g1:p1:r1" }],
          vision: visionOk("device-1", {
            serial_number: { value: "SN-1", confidence: 97 },
            sim_serial: { value: "SIM-1", confidence: 90 },
            tid: { value: "TID-1", confidence: 95 },
            merchant: { value: "Acme", confidence: 88 },
            branch: { value: "Riyadh", confidence: 85 },
          }),
        },
      ],
    });

    expect(result.graph.extraction_attempt_id).toBe("attempt_1");
    expect(result.provenance.pipeline_version).toBe("graph_runtime_v1");
    expect(result.graph.nodes.some((n) => n.kind === "device")).toBe(true);
    expect(result.graph.nodes.some((n) => n.kind === "identifier")).toBe(true);
    expect(result.graph.nodes.some((n) => n.kind === "commercial")).toBe(true);
    expect(result.graph.edges.some((e) => e.type === "co_located_on_page")).toBe(true);
    expect(result.graph.edges.some((e) => e.meta?.extraction_attempt_id === "attempt_1")).toBe(
      true,
    );

    const summaries = summarizeDevicesFromGraph(result.graph);
    expect(summaries[0]!.serial_number?.value).toBe("SN-1");
    expect(summaries[0]!.provenance.device_id).toBe("device-1");
  });

  it("detects cross-device duplicate SN and forces Review without merging", () => {
    const result = builder.build({
      document_id: "doc-dup",
      document_type: "installation_report",
      extraction_session_id: "extract_x",
      extraction_attempt_id: "attempt_2",
      devices: [
        {
          device_id: "device-1",
          device_index: 1,
          grouping_confidence: 90,
          images: [{ page: 1, quality_score: 90 }],
          vision: visionOk("device-1", {
            serial_number: { value: "SN-SAME", confidence: 99 },
            tid: { value: "T1", confidence: 90 },
          }),
        },
        {
          device_id: "device-2",
          device_index: 2,
          grouping_confidence: 90,
          images: [{ page: 2, quality_score: 90 }],
          vision: visionOk("device-2", {
            serial_number: { value: "SN-SAME", confidence: 98 },
            tid: { value: "T2", confidence: 90 },
          }),
        },
      ],
    });

    expect(result.issues.some((i) => i.code === "CROSS_DEVICE_DUPLICATE")).toBe(true);
    expect(listConflictEdges(result.graph).length).toBeGreaterThan(0);
    const devices = result.graph.nodes.filter((n) => n.kind === "device");
    expect(devices).toHaveLength(2);
    expect(devices.every((d) => d.kind === "device" && d.status === "Review")).toBe(true);
    expect(result.merge_decisions.every((d) => d.applied === false)).toBe(true);
  });

  it("keeps devices separate on merge_candidate and never applies merge", () => {
    const decisions = evaluateMergeRules([
      {
        device_id: "a",
        serial_number: { value: "SN-1", confidence: 99 },
        sim_serial: { value: "SIM-1", confidence: 99 },
        tid: { value: "TID-1", confidence: 99 },
      },
      {
        device_id: "b",
        serial_number: { value: "SN-1", confidence: 99 },
        sim_serial: { value: "SIM-1", confidence: 99 },
        tid: { value: "TID-1", confidence: 99 },
      },
    ]);
    expect(decisions[0]!.decision).toBe("merge_candidate");
    expect(decisions[0]!.applied).toBe(false);
  });

  it("prepares matching stubs without running Matching", () => {
    const result = builder.build({
      document_id: "doc-m",
      document_type: "installation_report",
      extraction_session_id: "extract_m",
      extraction_attempt_id: "attempt_3",
      devices: [
        {
          device_id: "device-1",
          device_index: 1,
          grouping_confidence: 90,
          images: [{ page: 1, quality_score: 90 }],
          vision: visionOk("device-1", {
            serial_number: { value: "SN-9", confidence: 95 },
          }),
        },
      ],
    });
    expect(result.matching_prep[0]!.ready_for_matching).toBe(true);
    expect(result.matching_prep[0]!.serial_number).toBe("SN-9");
    const candidate = result.graph.nodes.find((n) => n.kind === "match_candidate");
    expect(candidate && candidate.kind === "match_candidate" && candidate.mismatch_reason).toBe(
      "awaiting_matching_engine",
    );
  });

  it("marks vision failures as Failed and not ready for matching", () => {
    const result = builder.build({
      document_id: "doc-f",
      document_type: "installation_report",
      extraction_session_id: "extract_f",
      extraction_attempt_id: "attempt_4",
      devices: [
        {
          device_id: "device-1",
          device_index: 1,
          grouping_confidence: 80,
          images: [{ page: 1, quality_score: 50 }],
          vision: {
            device_id: "device-1",
            ok: false,
            schema_valid: false,
            schema_version: "schema_v3",
            prompt_version: "prompt_v2",
            provider_id: "fixture",
            fields: {},
            schema_errors: [],
            error: { code: "invalid_json", message: "bad" },
          },
        },
      ],
    });
    expect(result.issues.some((i) => i.code === "VISION_FAILED")).toBe(true);
    expect(result.matching_prep[0]!.ready_for_matching).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  CanonicalDeviceGraphBuilder,
  GraphMatchingEngine,
  TechnicianMatchingRuntime,
  buildExplanation,
  createMatchingFixturePorts,
  detectAmbiguity,
  isAiExtractionEnabled,
} from "../index.js";
import type { DeviceVisionExtraction } from "../vision/types.js";

function vision(
  device_id: string,
  fields: DeviceVisionExtraction["fields"],
): DeviceVisionExtraction {
  return {
    device_id,
    ok: true,
    schema_valid: true,
    schema_version: "schema_v3",
    prompt_version: "prompt_v2",
    provider_id: "fixture",
    fields,
    extraction_confidence: 92,
    schema_errors: [],
  };
}

function graphFor(fields: DeviceVisionExtraction["fields"], device_id = "device-1") {
  return new CanonicalDeviceGraphBuilder().build({
    document_id: "doc-match",
    document_type: "installation_report",
    extraction_session_id: "extract_match_1",
    extraction_attempt_id: "attempt_1",
    devices: [
      {
        device_id,
        device_index: 1,
        grouping_confidence: 90,
        images: [{ page: 1, quality_score: 90, image_id: "img:1" }],
        vision: vision(device_id, fields),
      },
    ],
  }).graph;
}

describe("PR-006A-6 Technician Matching Runtime", () => {
  const ports = createMatchingFixturePorts();
  const runtime = new TechnicianMatchingRuntime(ports);

  it("keeps feature disabled", () => {
    expect(isAiExtractionEnabled()).toBe(false);
  });

  it("exact match ranks TECH-001 with SN+SIM+TID explainability", async () => {
    const graph = graphFor({
      serial_number: { value: "SN-EXACT-001", confidence: 99 },
      sim_serial: { value: "SIM-EXACT-001", confidence: 99 },
      tid: { value: "TID-EXACT-001", confidence: 99 },
      merchant: { value: "تاجر الدقيقة", confidence: 90 },
      branch: { value: "الرياض - العليا", confidence: 90 },
    });
    const { results } = await runtime.match({ device_graph: graph });
    const r = results[0]!;
    expect(r.best?.technician_id).toBe("TECH-001");
    expect(r.best?.matched_reason.length).toBeGreaterThanOrEqual(3);
    expect(r.best?.confidence).toBeGreaterThanOrEqual(80);
    expect(r.explanation.some((l) => l.includes("✓"))).toBe(true);
    expect(r.provenance.matching_engine_version).toBe("matching_engine_v1");
    expect(r.provenance.extraction_attempt_id).toBe("attempt_1");
    expect(r.provenance.graph_version).toBe("device_graph_v1");
  });

  it("partial match without TID/SIM still returns candidates", async () => {
    const graph = graphFor({
      serial_number: { value: "SN-NO-TID", confidence: 95 },
      branch: { value: "المدينة", confidence: 80 },
    });
    const { results } = await runtime.match({ device_graph: graph });
    expect(results[0]!.best?.technician_id).toBe("TECH-001");
    expect(results[0]!.best?.matched_reason.some((x) => x.includes("تسلسلي"))).toBe(true);
  });

  it("duplicate serial produces ambiguity metadata and review band", async () => {
    const graph = graphFor({
      serial_number: { value: "SN-DUP-900", confidence: 99 },
      merchant: { value: "تاجر مكرر", confidence: 90 },
    });
    const { results } = await runtime.match({ device_graph: graph });
    const r = results[0]!;
    expect(r.candidates.length).toBeGreaterThanOrEqual(2);
    expect(r.ambiguity.multiple_technicians).toBe(true);
    expect(r.ambiguity.duplicate_serial).toBe(true);
    expect(r.ambiguity.codes).toContain("MULTIPLE_TECHNICIANS");
    expect(r.best?.confidence_band).not.toBe("auto_match_candidate");
  });

  it("unknown device returns empty candidates with provenance", async () => {
    const graph = graphFor({
      serial_number: { value: "SN-UNKNOWN-ZZZ", confidence: 90 },
    });
    const { results } = await runtime.match({ device_graph: graph });
    expect(results[0]!.candidates).toHaveLength(0);
    expect(results[0]!.best).toBeNull();
    expect(results[0]!.provenance.runtime_version).toBe("matching_runtime_v1");
  });

  it("ranking is deterministic across runs", async () => {
    const graph = graphFor({
      serial_number: { value: "SN-DUP-900", confidence: 99 },
    });
    const a = await runtime.match({ device_graph: graph });
    const b = await runtime.match({ device_graph: graph });
    expect(a.results[0]!.candidates.map((c) => c.execution_id)).toEqual(
      b.results[0]!.candidates.map((c) => c.execution_id),
    );
  });

  it("duplicate merchant alone yields multiple candidates / ambiguity", async () => {
    const graph = graphFor({
      merchant: { value: "تاجر شائع", confidence: 90 },
    });
    const { results } = await runtime.match({ device_graph: graph });
    expect(results[0]!.candidates.length).toBeGreaterThanOrEqual(2);
    expect(detectAmbiguity(results[0]!.candidates).multiple_technicians).toBe(true);
  });

  it("GraphMatchingEngine adapts to MatchResult contract", async () => {
    const engine = new GraphMatchingEngine(runtime);
    const graph = graphFor({
      serial_number: { value: "SN-EXACT-001", confidence: 99 },
      sim_serial: { value: "SIM-EXACT-001", confidence: 99 },
      tid: { value: "TID-EXACT-001", confidence: 99 },
    });
    const result = await engine.match({
      device_graph: graph,
      device_id: "device-1",
      ranking_strategy: "db_cascade_v1",
    });
    expect(result.technician?.id).toBe("TECH-001");
    expect(result.matched_reason.length).toBeGreaterThan(0);
    expect(result.match_confidence).toBeGreaterThan(0);
  });

  it("explainability never exposes raw weight numbers", () => {
    const lines = buildExplanation({
      technician_id: "T",
      technician_name: "X",
      request_id: 1,
      execution_id: "E",
      branch: "B",
      city: "C",
      custody_state: "open",
      installation_status: "pending",
      score: 40,
      confidence: 98,
      evidence_score: 40,
      ambiguity_score: 0,
      confidence_band: "auto_match_candidate",
      matched_reason: ["الرقم التسلسلي", "اسم التاجر"],
      rejected_reason: [],
      signals: [],
    });
    expect(lines.join("\n")).not.toMatch(/weight|WEIGHT|SIGNAL_WEIGHT/i);
    expect(lines.some((l) => l.includes("98%"))).toBe(true);
  });
});

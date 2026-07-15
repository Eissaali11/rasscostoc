import { describe, expect, it } from "vitest";
import {
  AI_EXTRACTION_FEATURE_FLAG,
  DisabledVisionProvider,
  InMemorySchemaRegistry,
  StubMatchingEngine,
  StructuralValidationEngine,
  addDeviceWithImages,
  assertAttemptMutable,
  computeDeviceFingerprint,
  createDocumentRecord,
  createEmptyDeviceGraph,
  createMemoryPersistence,
  createQueuedAttempt,
  finalizeAttempt,
  isAiExtractionEnabled,
  markAttemptRunning,
  nextAttemptNumber,
  openExtractionSession,
  summarizeDevicesFromGraph,
} from "../index.js";

function seedBundle(registry: InMemorySchemaRegistry) {
  return registry.publish({
    registry_bundle_id: "installation_v1",
    document_type: "installation_report",
    schema_version: "schema_v3",
    prompt_version: "prompt_v2",
    validation_rules_version: "validation_v2",
    business_rules_version: "rules_v2",
    multi_device: true,
    technician_matching: "required",
  });
}

describe("PR-006A-2 feature gate", () => {
  it("keeps AI extraction disabled by default", () => {
    expect(AI_EXTRACTION_FEATURE_FLAG.enabled).toBe(false);
    expect(isAiExtractionEnabled()).toBe(false);
  });
});

describe("fingerprint_v2", () => {
  it("hashes normalized parts and omits missing SIM", () => {
    const withSim = computeDeviceFingerprint({
      document_type: "installation_report",
      serial_number: " SN-1 ",
      sim_serial: "SIM-9",
      merchant: "Acme",
    });
    const withoutSim = computeDeviceFingerprint({
      document_type: "installation_report",
      serial_number: "SN-1",
      merchant: "Acme",
    });
    expect(withSim.fingerprint_version).toBe("fingerprint_v2");
    expect(withSim.device_fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(withoutSim.device_fingerprint).not.toBe(withSim.device_fingerprint);
  });
});

describe("Session / Attempt lifecycle", () => {
  it("creates document, session, attempt without overwriting prior attempts (A01–A03)", async () => {
    const db = createMemoryPersistence();
    const registry = new InMemorySchemaRegistry();
    const bundle = seedBundle(registry);

    const doc = createDocumentRecord({
      document_id: "doc-1",
      mime_type: "application/pdf",
      retention: "delete_after_extract",
    });
    await db.documents.save(doc);

    let session = openExtractionSession({
      document_id: doc.document_id,
      document_type: "installation_report",
      document_type_confidence: 94,
      registry_bundle_id: bundle.registry_bundle_id,
    });
    await db.sessions.save(session);

    const first = createQueuedAttempt({
      session,
      attempt_number: nextAttemptNumber(session),
      bundle,
      grouping_provider: "heuristic_v1",
      vision_provider: "disabled",
    });
    session = first.session;
    let attempt1 = markAttemptRunning(first.attempt);
    attempt1 = finalizeAttempt(attempt1, {
      status: "succeeded",
      device_graph: attempt1.device_graph,
    });
    await db.sessions.save(session);
    await db.attempts.save(attempt1);

    const second = createQueuedAttempt({
      session,
      attempt_number: nextAttemptNumber(session),
      bundle: registry.publish({
        ...bundle,
        registry_bundle_id: "installation_v2",
        prompt_version: "prompt_v3",
      }),
      grouping_provider: "heuristic_v1",
      vision_provider: "disabled",
    });
    session = second.session;
    const attempt2 = finalizeAttempt(markAttemptRunning(second.attempt), {
      status: "succeeded",
      device_graph: second.attempt.device_graph,
    });
    await db.sessions.save(session);
    await db.attempts.save(attempt2);

    const loaded1 = await db.attempts.getById(
      session.extraction_session_id,
      "attempt_1",
    );
    const loaded2 = await db.attempts.getById(
      session.extraction_session_id,
      "attempt_2",
    );
    expect(loaded1?.prompt_version).toBe("prompt_v2");
    expect(loaded2?.prompt_version).toBe("prompt_v3");
    expect(session.attempt_ids).toEqual(["attempt_1", "attempt_2"]);
  });

  it("refuses mutation of terminal attempts", async () => {
    const registry = new InMemorySchemaRegistry();
    const bundle = seedBundle(registry);
    const session = openExtractionSession({ document_id: "doc-2" });
    const { attempt } = createQueuedAttempt({
      session,
      attempt_number: 1,
      bundle,
      grouping_provider: "heuristic_v1",
      vision_provider: "disabled",
    });
    const done = finalizeAttempt(markAttemptRunning(attempt), {
      status: "succeeded",
      device_graph: attempt.device_graph,
    });
    expect(() => assertAttemptMutable(done)).toThrow(/immutable/);

    const db = createMemoryPersistence();
    await db.attempts.save(done);
    await expect(db.attempts.save({ ...done, vision_model: "x" })).rejects.toThrow(
      /immutable/,
    );
  });
});

describe("Canonical Device Graph", () => {
  it("preserves per-image quality_score and summarizes from graph only", () => {
    let graph = createEmptyDeviceGraph({
      extraction_session_id: "extract_20260714_000001",
      extraction_attempt_id: "attempt_1",
      document_id: "doc-3",
      document_type: "installation_report",
    });
    const fp = computeDeviceFingerprint({
      document_type: "installation_report",
      serial_number: "SN-A",
    });
    graph = addDeviceWithImages(graph, {
      device_id: "device-1",
      device_index: 1,
      grouping_confidence: 92,
      fingerprint: fp,
      images: [
        { page: 3, quality_score: 98 },
        { page: 4, quality_score: 15 },
        { page: 5, quality_score: 90 },
      ],
    });
    const summaries = summarizeDevicesFromGraph(graph);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].images.map((i) => i.quality_score)).toEqual([98, 15, 90]);
    expect(summaries[0].provenance.fingerprint_version).toBe("fingerprint_v2");
  });
});

describe("Registry immutability", () => {
  it("rejects republish of same bundle id", () => {
    const registry = new InMemorySchemaRegistry();
    seedBundle(registry);
    expect(() => seedBundle(registry)).toThrow(/immutable/);
  });
});

describe("Validation vs providers stubs", () => {
  it("structural validation flags missing devices", () => {
    const engine = new StructuralValidationEngine();
    const graph = createEmptyDeviceGraph({
      extraction_session_id: "s",
      extraction_attempt_id: "attempt_1",
      document_id: "d",
      document_type: "installation_report",
    });
    const issues = engine.validate(graph, "validation_v2");
    expect(issues.some((i) => i.code === "NO_DEVICES")).toBe(true);
  });

  it("DisabledVisionProvider never calls a live API", async () => {
    const vision = new DisabledVisionProvider();
    const result = await vision.extractDevice({
      device_id: "device-1",
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      images: [{ page: 1, quality_score: 80 }],
    });
    expect(result).toEqual({
      ok: false,
      code: "disabled",
      message: expect.stringContaining("disabled"),
    });
  });

  it("StubMatchingEngine returns explicit unmatched (not fake 100%)", async () => {
    const matching = new StubMatchingEngine();
    const graph = createEmptyDeviceGraph({
      extraction_session_id: "s",
      extraction_attempt_id: "attempt_1",
      document_id: "d",
      document_type: "installation_report",
    });
    const result = await matching.match({
      device_graph: graph,
      device_id: "device-1",
      ranking_strategy: "db_cascade_v1",
    });
    expect(result.match_confidence).toBe(0);
    expect(result.matched_by).toBeNull();
    expect(result.mismatch_reason).toBe("matching_deferred_to_006C");
  });
});

describe("Review / feedback persistence shapes", () => {
  it("stores versioned review and feedback records", async () => {
    const db = createMemoryPersistence();
    await db.reviews.append({
      review_version: 1,
      extraction_attempt_id: "attempt_1",
      device_id: "device-1",
      edited_by: "reviewer-1",
      edited_at: new Date().toISOString(),
      reason: "fix SN",
      field_diffs: [{ field: "serial_number", before: "A", after: "B" }],
    });
    await db.feedback.save({
      extraction_session_id: "extract_1",
      extraction_attempt_id: "attempt_1",
      device_id: "device-1",
      ai_suggestion: { serial_number: "A" },
      human_ground_truth: { serial_number: "B" },
      field_diffs: [{ field: "serial_number", before: "A", after: "B" }],
      created_at: new Date().toISOString(),
      created_by: "reviewer-1",
    });
    const reviews = await db.reviews.listByDevice("attempt_1", "device-1");
    const feedback = await db.feedback.listBySession("extract_1");
    expect(reviews).toHaveLength(1);
    expect(feedback).toHaveLength(1);
  });
});

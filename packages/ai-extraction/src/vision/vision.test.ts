import { describe, expect, it, vi } from "vitest";
import {
  AI_EXTRACTION_FEATURE_FLAG,
  FixtureVisionProvider,
  GeminiVisionAdapter,
  INSTALLATION_DEVICE_SCHEMA_V3,
  InvalidJsonVisionProvider,
  VisionExtractionService,
  extractConfidenceFields,
  isAiExtractionEnabled,
  isVisionLiveProductionAllowed,
  validateAgainstSchema,
} from "../index.js";
import type { GeminiHttpClient } from "./gemini-http.js";

function validDeviceJson(device_id: string, sn: string) {
  return {
    device_id,
    serial_number: { value: sn, confidence: 97 },
    sim_serial: { value: null, confidence: 20 },
    tid: { value: "TID-1", confidence: 90 },
    merchant: { value: "Acme", confidence: 85 },
    branch: { value: "Riyadh", confidence: 80 },
    extraction_confidence: 88,
  };
}

describe("PR-006A-4 gates", () => {
  it("keeps master and production vision flags false", () => {
    expect(AI_EXTRACTION_FEATURE_FLAG.enabled).toBe(false);
    expect(AI_EXTRACTION_FEATURE_FLAG.vision_live_production).toBe(false);
    expect(isAiExtractionEnabled()).toBe(false);
    expect(isVisionLiveProductionAllowed()).toBe(false);
  });
});

describe("JSON Schema validation", () => {
  it("accepts confidence-shaped installation JSON", () => {
    const result = validateAgainstSchema(
      validDeviceJson("device-1", "SN-1"),
      INSTALLATION_DEVICE_SCHEMA_V3 as never,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects missing required device_id and bad confidence", () => {
    const result = validateAgainstSchema(
      {
        serial_number: { value: "X", confidence: 150 },
      },
      INSTALLATION_DEVICE_SCHEMA_V3 as never,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("device_id"))).toBe(true);
  });
});

describe("per-field confidence", () => {
  it("extracts confidence fields", () => {
    const fields = extractConfidenceFields(validDeviceJson("device-1", "SN-9"));
    expect(fields.serial_number).toEqual({ value: "SN-9", confidence: 97 });
    expect(fields.sim_serial?.value).toBeNull();
  });
});

describe("VisionExtractionService multi-device", () => {
  it("extracts each device independently with schema + confidence", async () => {
    const provider = new FixtureVisionProvider({
      "device-1": validDeviceJson("device-1", "SN-A"),
      "device-2": validDeviceJson("device-2", "SN-B"),
    });
    const service = new VisionExtractionService({ provider });
    const result = await service.extractAll({
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      devices: [
        {
          device_id: "device-1",
          device_index: 1,
          images: [{ page: 1, quality_score: 90, image_id: "img:a:p1:r1" }],
        },
        {
          device_id: "device-2",
          device_index: 2,
          images: [{ page: 2, quality_score: 88, image_id: "img:a:p2:r1" }],
        },
      ],
    });
    expect(result.devices).toHaveLength(2);
    expect(result.devices.every((d) => d.ok && d.schema_valid)).toBe(true);
    expect(result.devices[0]!.fields.serial_number?.value).toBe("SN-A");
    expect(result.devices[1]!.fields.serial_number?.value).toBe("SN-B");
    expect(result.devices[0]!.provider_id).toBe("fixture_vision_v1");
  });

  it("marks invalid_json failures without inventing fields", async () => {
    const service = new VisionExtractionService({
      provider: new InvalidJsonVisionProvider(),
    });
    const result = await service.extractAll({
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      devices: [
        {
          device_id: "device-1",
          images: [{ page: 1, quality_score: 90 }],
        },
      ],
    });
    expect(result.devices[0]!.ok).toBe(false);
    expect(result.devices[0]!.error?.code).toBe("invalid_json");
    expect(Object.keys(result.devices[0]!.fields)).toHaveLength(0);
  });

  it("flags schema validation failures on ok provider JSON", async () => {
    const provider = new FixtureVisionProvider({
      "device-1": { device_id: "device-1", unexpected: true },
    });
    const service = new VisionExtractionService({ provider });
    const result = await service.extractAll({
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      devices: [{ device_id: "device-1", images: [{ page: 1, quality_score: 90 }] }],
    });
    expect(result.devices[0]!.schema_valid).toBe(false);
    expect(result.devices[0]!.schema_errors.length).toBeGreaterThan(0);
  });
});

describe("GeminiVisionAdapter", () => {
  it("does not call network when allowLive=false", async () => {
    const http: GeminiHttpClient = {
      generateContent: vi.fn(),
    };
    const adapter = new GeminiVisionAdapter({ allowLive: false, http, apiKey: "x" });
    const result = await adapter.extractDevice({
      device_id: "device-1",
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      images: [{ page: 1, quality_score: 90 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("disabled");
    expect(http.generateContent).not.toHaveBeenCalled();
  });

  it("parses structured JSON from injected HTTP client when allowLive=true", async () => {
    const http: GeminiHttpClient = {
      generateContent: vi.fn(async () => ({
        text: JSON.stringify(validDeviceJson("device-1", "SN-LIVE")),
        raw: {},
      })),
    };
    const adapter = new GeminiVisionAdapter({
      allowLive: true,
      apiKey: "test-key",
      http,
      model: "gemini-2.0-flash",
    });
    const result = await adapter.extractDevice({
      device_id: "device-1",
      document_type: "installation_report",
      schema_version: "schema_v3",
      prompt_version: "prompt_v2",
      images: [{ page: 1, quality_score: 90 }],
      image_payloads: [{ mime_type: "image/png", base64: "aaa" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.json.serial_number).toEqual({ value: "SN-LIVE", confidence: 97 });
    }
    expect(http.generateContent).toHaveBeenCalledOnce();
    const call = vi.mocked(http.generateContent).mock.calls[0]![0];
    expect(call.generationConfig.responseMimeType).toBe("application/json");
    expect(call.generationConfig.temperature).toBe(0);
  });
});

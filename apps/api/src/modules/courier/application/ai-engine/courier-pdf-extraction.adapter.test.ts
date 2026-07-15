import { describe, expect, it } from "vitest";
import {
  buildCompleteExecutionPayload,
  buildExtractedPayloadFromOcr,
  ensureDevicesInExtractedJson,
  normalizeOcrFieldsToDevices,
} from "./courier-pdf-extraction.adapter.js";

describe("PR-006A-9 Courier PDF extraction adapter", () => {
  it("maps flat OCR fields into a single device card", () => {
    const devices = normalizeOcrFieldsToDevices({
      sn: { value: "303021982", confidence: 95, source: "text_layer" },
      sim_serial: { value: "8996606099020521896", confidence: 90, source: "ocr" },
      tid: { value: "15805786", confidence: 88, source: "text_layer" },
      retailer_name: { value: "Merchant X", confidence: 70, source: "ocr" },
      date: { value: "07/12/2026", confidence: 80, source: "text_layer" },
      time: { value: "05:53 PM", confidence: 80, source: "text_layer" },
    });

    expect(devices).toHaveLength(1);
    expect(devices[0]?.sn).toBe("303021982");
    expect(devices[0]?.sim_serial).toBe("8996606099020521896");
    expect(devices[0]?.tid).toBe("15805786");
    expect(devices[0]?.match?.status).toBe("unknown");
  });

  it("builds stored payload with devices and extraction_source", () => {
    const payload = buildExtractedPayloadFromOcr({
      sn: { value: "SN-1", confidence: 91, source: "text_layer" },
      sim_serial: { value: null, confidence: 0, source: "none" },
      tid: { value: null, confidence: 0, source: "none" },
      date: { value: null, confidence: 0, source: "none" },
      time: { value: null, confidence: 0, source: "none" },
      retailer_name: { value: null, confidence: 0, source: "none" },
    });

    expect(payload.extraction_source).toBe("ocr");
    expect(payload.devices).toHaveLength(1);
    expect(payload.sn?.value).toBe("SN-1");
  });

  it("upgrades legacy extractedJson without devices[]", () => {
    const ensured = ensureDevicesInExtractedJson({
      sn: { value: "LEGACY-SN", confidence: 80 },
      sim_serial: { value: "LEGACY-SIM", confidence: 70 },
    });
    expect(ensured.devices).toHaveLength(1);
    expect(ensured.devices[0]?.sn).toBe("LEGACY-SN");
  });

  it("builds complete execution serial arrays for saveExecution", () => {
    const payload = buildCompleteExecutionPayload({
      devices: [
        {
          sn: "SN-A",
          sim_serial: "SIM-A",
          technician_code: "tech1",
          sales_technician: "أحمد",
        },
        { sn: "SN-B", sim_serial: "SIM-B" },
      ],
      deliveryDate: "2026-07-12",
      time: "17:53",
      paperRoll: "Yes",
    });

    expect(payload.deviceSerials).toEqual(["SN-A", "SN-B"]);
    expect(payload.simSerials).toEqual(["SIM-A", "SIM-B"]);
    expect(payload.sn).toBe("SN-A");
    expect(payload.simSerial).toBe("SIM-A");
    expect(payload.installationStatus).toBe("Installation Completed - NL");
    expect(payload.salesTechnician).toBe("أحمد");
    expect(payload.technicianCode).toBe("tech1");
  });

  it("maps Vision multi-device JSON into courier cards", async () => {
    const { normalizeVisionJsonToDevices, buildExtractedPayloadFromVision } = await import(
      "./courier-pdf-extraction.adapter.js"
    );
    const devices = normalizeVisionJsonToDevices({
      devices: [
        {
          serial_number: { value: "SN-100", confidence: 90 },
          sim_serial: { value: "899660601111", confidence: 85 },
          tid: { value: "TID1", confidence: 80 },
          merchant: { value: "Shop A", confidence: 70 },
        },
        {
          sn: "SN-200",
          sim_serial: { value: null, confidence: 0 },
          tid: { value: "TID2", confidence: 75 },
        },
      ],
    });
    expect(devices).toHaveLength(2);
    expect(devices[0]?.sn).toBe("SN-100");
    expect(devices[1]?.tid).toBe("TID2");

    const payload = buildExtractedPayloadFromVision({
      devices: [
        {
          serial_number: { value: "SN-X", confidence: 88 },
          sim_serial: { value: null, confidence: 0 },
          tid: { value: null, confidence: 0 },
          merchant: { value: null, confidence: 0 },
        },
      ],
      date: { value: "2026-07-12", confidence: 70 },
    });
    expect(payload.extraction_source).toBe("ai_engine");
    expect(payload.devices[0]?.sn).toBe("SN-X");
    expect(payload.date?.value).toBe("2026-07-12");
  });
});

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

  it("extracts receipt date (29/07/2026 -> 2026-07-29), transaction_time, approval_time, and ISO datetime with +03:00 timezone", async () => {
    const { normalizeReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = normalizeReceiptDateTime({
      transaction_date_raw: "29/07/2026",
      transaction_time_raw: "17:55:42",
      approval_time_raw: "17:55:43",
    });

    expect(result.transaction_date).toBe("2026-07-29");
    expect(result.transaction_time).toBe("17:55:42");
    expect(result.approval_time).toBe("17:55:43");
    expect(result.transaction_datetime).toBe("2026-07-29T17:55:42+03:00");
    expect(result.transaction_time_12h).toBe("05:55:42 PM");
    expect(result.approval_time_12h).toBe("05:55:43 PM");
    expect(result.date_source).toBe("receipt");
    expect(result.date_confidence).toBe(0.98);
  });

  it("returns null for transaction_date when date extraction fails (no silent upload_at fallback)", async () => {
    const { normalizeReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = normalizeReceiptDateTime({
      transaction_date_raw: null,
      transaction_time_raw: null,
    });

    expect(result.transaction_date).toBeNull();
    expect(result.transaction_time).toBeNull();
    expect(result.approval_time).toBeNull();
    expect(result.transaction_datetime).toBeNull();
    expect(result.date_source).toBeNull();
  });

  it("parses 12-hour AM/PM receipt times into 24-hour storage format", async () => {
    const { normalizeReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = normalizeReceiptDateTime({
      transaction_date_raw: "29/07/2026",
      transaction_time_raw: "05:55:42 PM",
      approval_time_raw: "12:05:00 AM",
    });

    expect(result.transaction_time).toBe("17:55:42");
    expect(result.approval_time).toBe("00:05:00");
  });

  it("assumes 20xx for a 2-digit receipt year (DD/MM/YY)", async () => {
    const { normalizeReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = normalizeReceiptDateTime({ transaction_date_raw: "29/07/26" });

    expect(result.transaction_date).toBe("2026-07-29");
  });

  it("normalizes Arabic-Indic digits in receipt date/time strings", async () => {
    const { normalizeReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = normalizeReceiptDateTime({
      transaction_date_raw: "٢٩/٠٧/٢٠٢٦",
      transaction_time_raw: "١٧:٥٥:٤٢",
    });

    expect(result.transaction_date).toBe("2026-07-29");
    expect(result.transaction_time).toBe("17:55:42");
  });

  it("never derives approval_time from the generic transaction time/date fields", async () => {
    const { deriveReceiptDateTime } = await import("./courier-pdf-extraction.adapter.js");

    const result = deriveReceiptDateTime({
      date: { value: "29/07/2026", confidence: 99 },
      time: { value: "17:55:42", confidence: 99 },
      // no approval_time anywhere in the payload
    });

    expect(result.transaction_date).toBe("2026-07-29");
    expect(result.transaction_time).toBe("17:55:42");
    expect(result.approval_time).toBeNull();
  });

  it("derives transaction_date/time and approval_time from a bot-shaped Vision payload via ensureDevicesInExtractedJson", async () => {
    const { ensureDevicesInExtractedJson } = await import("./courier-pdf-extraction.adapter.js");

    const ensured = ensureDevicesInExtractedJson({
      devices: [{ sn: "SN-1", sim_serial: "SIM-1", tid: "TID-1", merchant: "M", confidence: 90 }],
      date: { value: "29/07/2026", confidence: 98 },
      time: { value: "17:55:42", confidence: 98 },
      approval_time: { value: "17:55:43", confidence: 95 },
    });

    expect(ensured.transaction_date).toBe("2026-07-29");
    expect(ensured.transaction_time).toBe("17:55:42");
    expect(ensured.approval_time).toBe("17:55:43");
    expect(ensured.transaction_datetime).toBe("2026-07-29T17:55:42+03:00");
  });

  it("does not fall back to uploaded_at/created_at when no receipt date is present", async () => {
    const { ensureDevicesInExtractedJson } = await import("./courier-pdf-extraction.adapter.js");

    const ensured: any = ensureDevicesInExtractedJson({
      devices: [{ sn: "SN-1", confidence: 90 }],
      uploaded_at: "2026-07-30T10:00:00Z",
      created_at: "2026-07-30T10:00:01Z",
    });

    expect(ensured.transaction_date).toBeNull();
    expect(ensured.date_source).toBeNull();
  });

  it("converts Google Drive /view and ?usp=drivesdk links to /preview and rejects non-Drive / local URLs", async () => {
    const { buildGoogleDrivePreviewUrl } = await import("../../../../../../portal/src/pages/courier/google-drive-preview");

    expect(
      buildGoogleDrivePreviewUrl(
        "https://drive.google.com/file/d/1V47IFZX6gD1CknaVRJbIPyLmxEW1VNb_/view?usp=drivesdk"
      )
    ).toBe("https://drive.google.com/file/d/1V47IFZX6gD1CknaVRJbIPyLmxEW1VNb_/preview");

    expect(
      buildGoogleDrivePreviewUrl("https://drive.google.com/open?id=1V47IFZX6gD1CknaVRJbIPyLmxEW1VNb_")
    ).toBe("https://drive.google.com/file/d/1V47IFZX6gD1CknaVRJbIPyLmxEW1VNb_/preview");

    expect(buildGoogleDrivePreviewUrl("blob:http://localhost:5000/1234")).toBeNull();
    expect(buildGoogleDrivePreviewUrl("file:///C:/temp/file.pdf")).toBeNull();
    expect(buildGoogleDrivePreviewUrl("javascript:alert(1)")).toBeNull();
  });
});

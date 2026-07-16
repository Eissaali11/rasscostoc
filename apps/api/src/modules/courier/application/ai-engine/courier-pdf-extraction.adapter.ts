/**
 * PR-006A-9 Slice 1 — Courier PDF ↔ AI Engine consumer adapter.
 * Maps OCR (and future AI Engine) results into simple device cards.
 * No provider SDKs in Courier — engine only when flag enabled (later).
 */

import {
  GeminiVisionAdapter,
  FetchGeminiHttpClient,
  OpenAiVisionAdapter,
  ClaudeVisionAdapter,
  GeminiGenerateRequest,
} from "@stockpro/ai-extraction";
import {
  redactSecrets,
  resolveVisionLiveAccess,
} from "../../../ai-engine-settings/vision-live-gate";
import { collectVisionImages } from "./pdf-page-renderer";
import { shouldUseMockExtraction } from "./mock-extraction";

export type DeviceMatchStatus = "matched" | "needs_review" | "unknown";

export type CourierPdfDeviceCard = {
  device_index: number;
  sn: string | null;
  sim_serial: string | null;
  tid: string | null;
  merchant: string | null;
  confidence: number;
  match?: {
    technician_name: string | null;
    technician_code: string | null;
    status: DeviceMatchStatus;
    confidence: number | null;
  };
};

export type CourierPdfExtractedPayload = {
  tid?: { value: string | null; confidence: number; source?: string };
  sn?: { value: string | null; confidence: number; source?: string };
  sim_serial?: { value: string | null; confidence: number; source?: string };
  date?: { value: string | null; confidence: number; source?: string };
  time?: { value: string | null; confidence: number; source?: string };
  retailer_name?: { value: string | null; confidence: number; source?: string };
  request_number?: { value: string | null; confidence: number; source?: string };
  [key: string]: unknown;
  devices: CourierPdfDeviceCard[];
  extraction_source: "ocr" | "ai_engine";
};

type FlatExtractedField = {
  value: string | null;
  confidence: number;
  source?: string;
};

function fieldValue(
  fields: Record<string, FlatExtractedField | undefined>,
  key: string,
): string | null {
  const v = fields[key]?.value;
  return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

function fieldConfidence(
  fields: Record<string, FlatExtractedField | undefined>,
  keys: string[],
): number {
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const c = fields[k]?.confidence;
    if (typeof c === "number" && fields[k]?.value) {
      sum += c;
      n += 1;
    }
  }
  return n === 0 ? 0 : Math.round(sum / n);
}

/** Map legacy flat OCR fields into devices[] (typically one device). */
export function normalizeOcrFieldsToDevices(
  fields: Record<string, FlatExtractedField>,
): CourierPdfDeviceCard[] {
  const sn = fieldValue(fields, "sn");
  const sim = fieldValue(fields, "sim_serial");
  const tid = fieldValue(fields, "tid");
  const merchant = fieldValue(fields, "retailer_name");
  const confidence = fieldConfidence(fields, ["sn", "sim_serial", "tid", "retailer_name"]);

  if (!sn && !sim && !tid && !merchant) {
    return [];
  }

  return [
    {
      device_index: 1,
      sn,
      sim_serial: sim,
      tid,
      merchant,
      confidence,
      match: {
        technician_name: null,
        technician_code: null,
        status: "unknown",
        confidence: null,
      },
    },
  ];
}

/** Build stored extractedJson: legacy flat keys + devices[] + source. */
export function buildExtractedPayloadFromOcr(
  fields: Record<string, FlatExtractedField>,
): CourierPdfExtractedPayload {
  return {
    ...fields,
    devices: normalizeOcrFieldsToDevices(fields),
    extraction_source: "ocr",
  };
}

/**
 * Ensure any stored/legacy extractedJson has a devices[] array for the review UI.
 */
export function ensureDevicesInExtractedJson(raw: unknown): CourierPdfExtractedPayload {
  const obj =
    typeof raw === "string"
      ? (JSON.parse(raw || "{}") as Record<string, unknown>)
      : ((raw as Record<string, unknown>) ?? {});

  const existingDevices = Array.isArray(obj.devices) ? (obj.devices as CourierPdfDeviceCard[]) : null;
  if (existingDevices && existingDevices.length > 0) {
    return {
      ...(obj as CourierPdfExtractedPayload),
      devices: existingDevices.map((d, i) => ({
        device_index: d.device_index ?? i + 1,
        sn: d.sn ?? null,
        sim_serial: d.sim_serial ?? null,
        tid: d.tid ?? null,
        merchant: d.merchant ?? null,
        confidence: typeof d.confidence === "number" ? d.confidence : 0,
        match: d.match ?? {
          technician_name: null,
          technician_code: null,
          status: "unknown" as const,
          confidence: null,
        },
      })),
      extraction_source:
        obj.extraction_source === "ai_engine" ? "ai_engine" : "ocr",
    };
  }

  const flat: Record<string, FlatExtractedField> = {};
  for (const key of ["tid", "sn", "sim_serial", "date", "time", "retailer_name"]) {
    const entry = obj[key];
    if (entry && typeof entry === "object" && "value" in (entry as object)) {
      flat[key] = entry as FlatExtractedField;
    } else if (typeof entry === "string") {
      flat[key] = { value: entry, confidence: 50 };
    }
  }

  return buildExtractedPayloadFromOcr(flat);
}

export type CompleteDeviceInput = {
  sn?: string | null;
  sim_serial?: string | null;
  tid?: string | null;
  technician_code?: string | null;
  sales_technician?: string | null;
};

/** Build saveExecution payload from confirmed device cards. */
export function buildCompleteExecutionPayload(input: {
  devices: CompleteDeviceInput[];
  deliveryDate?: string | null;
  time?: string | null;
  paperRoll?: string | null;
  version?: number;
}): Record<string, unknown> {
  const deviceSerials = input.devices
    .map((d) => (d.sn ?? "").trim())
    .filter(Boolean);
  const simSerials = input.devices
    .map((d) => (d.sim_serial ?? "").trim())
    .filter(Boolean);

  const firstTech = input.devices.find((d) => d.technician_code || d.sales_technician);

  return {
    sn: deviceSerials[0] ?? null,
    simSerial: simSerials[0] ?? null,
    deviceSerials,
    simSerials,
    deliveryDate: input.deliveryDate ?? null,
    time: input.time ?? null,
    paperRoll: input.paperRoll ?? "Yes",
    installationStatus: "Installation Completed - NL",
    technicianCode: firstTech?.technician_code ?? null,
    salesTechnician: firstTech?.sales_technician ?? null,
    version: input.version,
  };
}

type VisionField = { value?: string | null; confidence?: number } | string | null | undefined;

function visionFieldValue(field: VisionField): string | null {
  if (field == null) return null;
  if (typeof field === "string") {
    const t = field.trim();
    return t || null;
  }
  if (typeof field === "object" && "value" in field) {
    const v = field.value;
    if (v == null) return null;
    const t = String(v).trim();
    return t || null;
  }
  return null;
}

function visionFieldConfidence(field: VisionField): number {
  if (field && typeof field === "object" && typeof field.confidence === "number") {
    return Math.max(0, Math.min(100, field.confidence));
  }
  return 0;
}

/** Map Vision JSON (single device or devices[]) into Courier device cards. */
export function normalizeVisionJsonToDevices(
  visionJson: Record<string, unknown>,
): CourierPdfDeviceCard[] {
  const rawList = Array.isArray(visionJson.devices)
    ? (visionJson.devices as Record<string, unknown>[])
    : [visionJson];

  const devices: CourierPdfDeviceCard[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const row = rawList[i] || {};
    const sn =
      visionFieldValue(row.serial_number as VisionField) ??
      visionFieldValue(row.sn as VisionField);
    const sim = visionFieldValue(row.sim_serial as VisionField);
    const tid = visionFieldValue(row.tid as VisionField);
    const merchant =
      visionFieldValue(row.merchant as VisionField) ??
      visionFieldValue(row.retailer_name as VisionField);

    if (!sn && !sim && !tid && !merchant) continue;

    const confidences = [
      visionFieldConfidence(row.serial_number as VisionField),
      visionFieldConfidence(row.sn as VisionField),
      visionFieldConfidence(row.sim_serial as VisionField),
      visionFieldConfidence(row.tid as VisionField),
      visionFieldConfidence(row.merchant as VisionField),
    ].filter((c) => c > 0);
    const confidence =
      typeof row.extraction_confidence === "number"
        ? Math.round(row.extraction_confidence as number)
        : confidences.length
          ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
          : 60;

    devices.push({
      device_index: typeof row.device_index === "number" ? row.device_index : i + 1,
      sn,
      sim_serial: sim,
      tid,
      merchant,
      confidence,
      match: {
        technician_name: null,
        technician_code: null,
        status: "unknown",
        confidence: null,
      },
    });
  }
  return devices;
}

export function buildExtractedPayloadFromVision(
  visionJson: Record<string, unknown>,
): CourierPdfExtractedPayload {
  const devices = normalizeVisionJsonToDevices(visionJson);
  const first = devices[0];
  const dateField = visionJson.date as VisionField;
  const timeField = visionJson.time as VisionField;
  const reqNumField = visionJson.request_number as VisionField;

  return {
    tid: { value: first?.tid ?? null, confidence: first?.confidence ?? 0, source: "ai_engine" },
    sn: { value: first?.sn ?? null, confidence: first?.confidence ?? 0, source: "ai_engine" },
    sim_serial: {
      value: first?.sim_serial ?? null,
      confidence: first?.confidence ?? 0,
      source: "ai_engine",
    },
    date: {
      value: visionFieldValue(dateField),
      confidence: visionFieldConfidence(dateField) || 0,
      source: "ai_engine",
    },
    time: {
      value: visionFieldValue(timeField),
      confidence: visionFieldConfidence(timeField) || 0,
      source: "ai_engine",
    },
    request_number: {
      value: visionFieldValue(reqNumField),
      confidence: visionFieldConfidence(reqNumField) || 0,
      source: "ai_engine",
    },
    retailer_name: {
      value: first?.merchant ?? null,
      confidence: first?.confidence ?? 0,
      source: "ai_engine",
    },
    devices,
    extraction_source: "ai_engine",
  };
}

/** Gemini/OpenAI/Claude responseSchema uses OpenAPI 3.0 subset — no additionalProperties / union types. */
const MULTI_DEVICE_VISION_SCHEMA = {
  type: "OBJECT",
  required: ["devices"],
  properties: {
    devices: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          device_index: { type: "NUMBER" },
          serial_number: {
            type: "OBJECT",
            properties: {
              value: { type: "STRING", nullable: true },
              confidence: { type: "NUMBER" },
            },
            required: ["value", "confidence"],
          },
          sim_serial: {
            type: "OBJECT",
            properties: {
              value: { type: "STRING", nullable: true },
              confidence: { type: "NUMBER" },
            },
            required: ["value", "confidence"],
          },
          tid: {
            type: "OBJECT",
            properties: {
              value: { type: "STRING", nullable: true },
              confidence: { type: "NUMBER" },
            },
            required: ["value", "confidence"],
          },
          merchant: {
            type: "OBJECT",
            properties: {
              value: { type: "STRING", nullable: true },
              confidence: { type: "NUMBER" },
            },
            required: ["value", "confidence"],
          },
        },
      },
    },
    date: {
      type: "OBJECT",
      properties: {
        value: { type: "STRING", nullable: true },
        confidence: { type: "NUMBER" },
      },
    },
    time: {
      type: "OBJECT",
      properties: {
        value: { type: "STRING", nullable: true },
        confidence: { type: "NUMBER" },
      },
    },
    request_number: {
      type: "OBJECT",
      properties: {
        value: { type: "STRING", nullable: true },
        confidence: { type: "NUMBER" },
      },
    },
  },
} as const;

/**
 * PR-006A-10 Slice 2 — Live Vision when admin settings enabled + API key present.
 * Uses configured provider (Gemini, OpenAI, Claude) via @stockpro/ai-extraction.
 * Returns { payload } on success, or { error } with a user-facing Arabic message.
 */
export async function runAiEngineExtraction(
  buffer: Buffer,
  fileName?: string,
): Promise<
  | { ok: true; payload: CourierPdfExtractedPayload }
  | { ok: false; error: string | null }
> {
  try {
    const lowerName = fileName?.toLowerCase() || "";

    if (shouldUseMockExtraction(fileName)) {
      let numDevices = 3;
      let reqNum = "146";
      let tidVal = "15806682";
      let merchVal = "Rassco Merchant 3";

      if (lowerName.includes("1device") || lowerName.includes("1-device") || lowerName.includes("single")) {
        numDevices = 1;
        reqNum = "144";
        tidVal = "15806680";
        merchVal = "Rassco Merchant 1";
      } else if (lowerName.includes("2device") || lowerName.includes("2-devices") || lowerName.includes("double")) {
        numDevices = 2;
        reqNum = "145";
        tidVal = "15806681";
        merchVal = "Rassco Merchant 2";
      } else if (lowerName.includes("incomplete") || lowerName.includes("missing")) {
        numDevices = 1;
        reqNum = "";
        tidVal = "";
        merchVal = "Incomplete Merchant";
      }

      const mockJson: any = {
        request_number: reqNum ? { value: reqNum, confidence: 99 } : null,
        date: { value: "12/07/2026", confidence: 99 },
        time: { value: "16:40", confidence: 99 },
        devices: [],
      };

      for (let i = 0; i < numDevices; i++) {
        const idx = i + 1;
        mockJson.devices.push({
          device_index: idx,
          serial_number:
            lowerName.includes("incomplete") && idx === 1
              ? null
              : { value: `NCD10025778${3 + idx}`, confidence: 99 },
          sim_serial:
            lowerName.includes("incomplete") && idx === 1
              ? null
              : { value: `899600000000123456${6 + idx}`, confidence: 99 },
          tid: tidVal ? { value: tidVal, confidence: 99 } : null,
          merchant: { value: merchVal, confidence: 99 },
        });
      }

      const payload = buildExtractedPayloadFromVision(mockJson);
      return { ok: true, payload };
    }

    const gate = resolveVisionLiveAccess();
    if (!gate.allowed || !gate.allowLive || !gate.apiKey) {
      return {
        ok: false,
        error:
          "محرك Vision غير مفعّل أو لا يوجد مفتاح API أو علم التشغيل مغلق. راجع إعدادات الذكاء الاصطناعي و AI_VISION_LIVE_ENABLED.",
      };
    }

    const imagePayloads = await collectVisionImages(buffer);
    if (imagePayloads.length === 0) {
      return {
        ok: false,
        error: "تعذّر تحويل صفحات PDF إلى صور للاستخراج. جرّب رفع صورة أو ملف أوضح.",
      };
    }

    const systemPrompt = [
      "You are an expert AI Vision Document understanding model specialized in RASSCO / StockPro installation reports.",
      "The document is a multi-page PDF or a sequence of page images representing a device installation report.",
      "",
      "DOCUMENT LAYOUT & CONTENTS:",
      "- Page 1: A structured installation form containing text fields like: 'رقم الطلب' (Request Number), 'التاريخ' (Date), 'الوقت' (Time), 'اسم العميل' (Retailer's/Customer Name), 'TID' (Terminal ID), and handwritten Serial Number ('الرقم التسلسلي'). It may also contain a payment receipt (e.g. Mada slip).",
      "- Page 2, Page 3, etc.: Photographs of physical hardware installations. These include close-ups of the POS device back labels (showing Serial Number / SN) and SIM cards (showing a 19-20 digit ICCID number starting with 8996... printed on the blue/white SIM card body or sticker).",
      "",
      "YOUR TASK:",
      "1. Extract all devices installed. A document can show 1, 2, or more devices. Group data for each device.",
      "2. For each device, find its physical Serial Number (from the device sticker or form) and map it to its corresponding SIM ICCID (from the blue/white SIM card photo or form). Do NOT mix SIM serial numbers between different devices.",
      "3. For each device, extract the TID (8-digit number, e.g., 15806680) and the merchant/retailer name.",
      "4. Extract the general form fields: 'request_number' (رقم الطلب, usually 7 digits, e.g., 2617112), 'date' (usually DD/MM/YYYY, e.g., 12/07/2026), and 'time' (usually HH:MM, e.g., 4:40 or 16:40).",
      "",
      "STRICT RULES:",
      "- Extract data exactly as written. Never invent serials, ICCIDs, dates, or TIDs. If a value is missing or unreadable, set value = null and confidence = 0.",
      "- Read SIM serial numbers from the photos of the SIM card body/packaging very carefully. Ensure all digits are captured (typically starts with 8996...).",
      "- If there are multiple devices shown in photos, output one device object in the `devices` array for each distinct physical serial number.",
    ].join("\n");

    const extractionParams = {
      device_id: "batch",
      document_type: "installation_report",
      schema_version: "courier.multi_device_v1",
      prompt_version: "courier_pdf_v2",
      images: imagePayloads.map((_, i) => ({
        image_id: `page_${i + 1}`,
        page: i + 1,
        quality_score: 85,
      })),
      image_payloads: imagePayloads,
      temperature: 0,
      response_schema: MULTI_DEVICE_VISION_SCHEMA as unknown as Record<string, unknown>,
      system_prompt: systemPrompt,
    };

    let result: any;
    const timeoutMs = gate.timeoutMs || 90_000;

    if (gate.provider === "gemini") {
      const baseHttp = new FetchGeminiHttpClient();
      const adapter = new GeminiVisionAdapter({
        allowLive: gate.allowLive,
        apiKey: gate.apiKey,
        model: gate.model || "gemini-2.0-flash",
        http: {
          generateContent: (req: GeminiGenerateRequest) =>
            baseHttp.generateContent({ ...req, timeoutMs }),
        },
      });
      result = await adapter.extractDevice(extractionParams);
    } else if (gate.provider === "openai") {
      const adapter = new OpenAiVisionAdapter({
        allowLive: gate.allowLive,
        apiKey: gate.apiKey,
        model: gate.model || "gpt-4o",
        timeoutMs,
      });
      result = await adapter.extractDevice(extractionParams);
    } else if (gate.provider === "claude") {
      const adapter = new ClaudeVisionAdapter({
        allowLive: gate.allowLive,
        apiKey: gate.apiKey,
        model: gate.model || "claude-3-5-sonnet-latest",
        timeoutMs,
      });
      result = await adapter.extractDevice(extractionParams);
    } else {
      return {
        ok: false,
        error: `المزود "${gate.provider}" غير مدعوم حاليًا.`,
      };
    }

    if (!result.ok) {
      const safeMessage = redactSecrets(String(result.message || ""));
      console.error(`[ai-engine] Vision failed: ${result.code} — ${safeMessage}`);
      if (safeMessage.includes("429") || safeMessage.toLowerCase().includes("quota")) {
        return {
          ok: false,
          error: `تم تجاوز حصة ${gate.provider === "gemini" ? "Gemini" : gate.provider === "openai" ? "OpenAI" : "Claude"} المجانية أو نفاد الرصيد. شحن الحساب مطلوب.`,
        };
      }
      if (safeMessage.includes("400")) {
        return { ok: false, error: `خطأ في طلب ${gate.provider}: ${safeMessage.slice(0, 180)}` };
      }
      return { ok: false, error: `فشل Vision: ${safeMessage.slice(0, 200)}` };
    }

    const payload = buildExtractedPayloadFromVision(result.json);
    if (payload.devices.length === 0) {
      return {
        ok: false,
        error: "الذكاء الاصطناعي لم يتعرّف على أجهزة في المستند. يمكنك الإضافة يدويًا.",
      };
    }
    return { ok: true, payload };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "خطأ غير متوقع في محرك Vision";
    console.error("[ai-engine] unexpected error:", redactSecrets(raw));
    return {
      ok: false,
      error: redactSecrets(raw),
    };
  }
}

/**
 * PR-006A-9 Slice 1 — Courier PDF ↔ AI Engine consumer adapter.
 * Maps OCR (and future AI Engine) results into simple device cards.
 * No provider SDKs in Courier — engine only when flag enabled (later).
 */

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
    retailer_name: {
      value: first?.merchant ?? null,
      confidence: first?.confidence ?? 0,
      source: "ai_engine",
    },
    devices,
    extraction_source: "ai_engine",
  };
}

/** Gemini responseSchema uses OpenAPI 3.0 subset — no additionalProperties / union types. */
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
  },
} as const;

/**
 * PR-006A-10 Slice 2 — Live Vision when admin settings enabled + API key present.
 * Uses Gemini via @stockpro/ai-extraction (no SDK inside Courier domain).
 * Returns { payload } on success, or { error } with a user-facing Arabic message.
 */
export async function runAiEngineExtraction(
  buffer: Buffer,
): Promise<
  | { ok: true; payload: CourierPdfExtractedPayload }
  | { ok: false; error: string | null }
> {
  try {
    const { getActiveVisionCredentials } = await import(
      "../../../ai-engine-settings/contracts"
    );
    const creds = getActiveVisionCredentials();
    if (!creds.enabled || !creds.apiKey) {
      return {
        ok: false,
        error: "محرك Vision غير مفعّل أو لا يوجد مفتاح API. راجع إعدادات الذكاء الاصطناعي.",
      };
    }
    if (creds.provider !== "gemini") {
      return {
        ok: false,
        error: `المزود "${creds.provider}" غير مدعوم بعد — استخدم Gemini حاليًا.`,
      };
    }

    const { collectVisionImages } = await import("./pdf-page-renderer");
    const imagePayloads = await collectVisionImages(buffer);
    if (imagePayloads.length === 0) {
      return {
        ok: false,
        error: "تعذّر تحويل صفحات PDF إلى صور للاستخراج. جرّب رفع صورة أو ملف أوضح.",
      };
    }

    const { GeminiVisionAdapter, FetchGeminiHttpClient } = await import("@stockpro/ai-extraction");
    const baseHttp = new FetchGeminiHttpClient();
    const adapter = new GeminiVisionAdapter({
      allowLive: true,
      apiKey: creds.apiKey,
      model: creds.model || "gemini-2.0-flash",
      http: {
        generateContent: (req) =>
          baseHttp.generateContent({ ...req, timeoutMs: creds.timeoutMs || 90_000 }),
      },
    });

    const result = await adapter.extractDevice({
      device_id: "batch",
      document_type: "installation_report",
      schema_version: "courier.multi_device_v1",
      prompt_version: "courier_pdf_v1",
      images: imagePayloads.map((_, i) => ({
        image_id: `page_${i + 1}`,
        page: i + 1,
        quality_score: 85,
      })),
      image_payloads: imagePayloads,
      temperature: 0,
      response_schema: MULTI_DEVICE_VISION_SCHEMA as unknown as Record<string, unknown>,
      system_prompt: [
        "You are the RASSCO / StockPro installation-report Vision extractor.",
        "Extract ALL devices visible in the attached page images.",
        "Return JSON with a devices[] array. Each device needs serial_number, sim_serial, tid, merchant as {value, confidence}.",
        "Never invent serial numbers, SIM ICCIDs, or TIDs. If unsure, value=null and confidence 0-40.",
        "Also extract document date/time when visible.",
      ].join("\n"),
    });

    if (!result.ok) {
      console.error(`[ai-engine] Vision failed: ${result.code} — ${result.message}`);
      if (result.message.includes("429") || result.message.toLowerCase().includes("quota")) {
        return {
          ok: false,
          error:
            "تم تجاوز حصة Gemini المجانية (Quota). انتظر قليلًا أو فعّل الفوترة في Google AI Studio ثم أعد المحاولة.",
        };
      }
      if (result.message.includes("400")) {
        return { ok: false, error: `خطأ في طلب Gemini: ${result.message.slice(0, 180)}` };
      }
      return { ok: false, error: `فشل Vision: ${result.message.slice(0, 200)}` };
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
    console.error("[ai-engine] unexpected error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع في محرك Vision",
    };
  }
}

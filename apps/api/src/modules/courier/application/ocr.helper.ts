import { createWorker } from "tesseract.js";

export interface ExtractedField {
  value: string | null;
  confidence: number; // 0-100
  source: "text_layer" | "ocr" | "none";
}

export interface ExtractionResult {
  fields: Record<string, ExtractedField>;
  overallConfidence: number;
  rawText: string;
}

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  tid: [/\bTID\s*[:#]?\s*([A-Z0-9]{6,15})/i, /\bTerminal\s*ID\s*[:#]?\s*([A-Z0-9]{6,15})/i],
  sn: [/\bS\/?N\s*[:#]?\s*([A-Z0-9]{6,20})/i, /\bSerial\s*(?:No\.?|Number)?\s*[:#]?\s*([A-Z0-9]{6,20})/i],
  sim_serial: [/\b(89\d{16,18})\b/, /\bICCID\s*[:#]?\s*(\d{18,20})/i],
  date: [/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/, /\b(\d{4}-\d{2}-\d{2})\b/],
  time: [/\b(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\b/],
  retailer_name: [/\bRetailer\s*Name\s*[:#]?\s*([A-Za-z0-9 &.\-']{3,60})/i],
};

function extractFromText(text: string): Record<string, ExtractedField> {
  const fields: Record<string, ExtractedField> = {};
  for (const [key, patterns] of Object.entries(FIELD_PATTERNS)) {
    let found: string | null = null;
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        found = match[1].trim();
        break;
      }
    }
    fields[key] = found
      ? { value: found, confidence: 95, source: "text_layer" }
      : { value: null, confidence: 0, source: "none" };
  }
  return fields;
}

function mergeFields(
  primary: Record<string, ExtractedField>,
  secondary: Record<string, ExtractedField>
): Record<string, ExtractedField> {
  const merged: Record<string, ExtractedField> = { ...primary };
  for (const [key, field] of Object.entries(secondary)) {
    if ((!merged[key] || merged[key].value === null) && field.value) {
      merged[key] = field;
    }
  }
  return merged;
}

async function extractTextLayer(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const PDFParse = ((pdfParseModule as any).default || pdfParseModule) as any;
  try {
    const result = await PDFParse(buffer);
    return result.text || "";
  } catch (err) {
    console.error("[ocr] PDF text layer extraction failed:", err);
    return "";
  }
}


// In Node, rendering PDF to screenshots can require pdf-img-convert or similar libraries.
// If pdf-parse text layer extraction works, we use it directly.
// If not, we log a warning or return empty images list.
async function renderPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  // Since we are running in an Express server and pdf-parse doesn't natively screenshot,
  // we default to no screenshots unless external native libraries are configured,
  // to avoid complex system dependencies.
  return [];
}

const FIELD_KEYS = ["tid", "sn", "sim_serial", "date", "time", "retailer_name"] as const;

function getMimeType(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" {
  const hex = buf.slice(0, 4).toString("hex");
  if (hex.startsWith("89504e47")) return "image/png";
  if (hex.startsWith("ffd8")) return "image/jpeg";
  if (buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return "image/png"; // default fallback
}

async function extractWithAiVision(
  imageBuffers: Buffer[]
): Promise<Record<string, ExtractedField> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || imageBuffers.length === 0) return null;

  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-20240620";
  const images = imageBuffers.slice(0, 3).map((buf) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: getMimeType(buf),
      data: buf.toString("base64"),
    },
  }));

  const prompt = `You are reading a scanned technician installation report for a payment terminal.
Extract these fields if visible: TID (terminal ID), SN (device serial number), SIM Serial / ICCID
(a long numeric code, usually starting with 89), Date, Time, Retailer Name.
Respond ONLY with strict JSON: {"tid":"...","sn":"...","sim_serial":"...","date":"...","time":"...","retailer_name":"..."}
Use null for any field you cannot read confidently.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [...images, { type: "text", text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as any;
    const text: string | undefined = data?.content?.[0]?.text;
    if (!text) return null;

    const jsonMatch = /\{[\s\S]*\}/.exec(text);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string | null>;

    const fields: Record<string, ExtractedField> = {};
    for (const key of FIELD_KEYS) {
      const value = parsed[key];
      fields[key] = value
        ? { value, confidence: 85, source: "ocr" }
        : { value: null, confidence: 0, source: "none" };
    }
    return fields;
  } catch {
    return null;
  }
}

export async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const isPdf = buffer.slice(0, 4).toString() === "%PDF";

  if (!isPdf) {
    // This is an image file uploaded directly (e.g. from WhatsApp)
    console.log("[ocr] Uploaded file is an image, skipping PDF parsing...");
    
    // 1. Try AI Vision extraction first (highly accurate for handwritten forms & pictures of barcodes)
    const aiFields = await extractWithAiVision([buffer]);
    if (aiFields && Object.values(aiFields).some((f) => f.value !== null)) {
      const values = Object.values(aiFields);
      const overallConfidence = Math.round(values.reduce((sum, f) => sum + f.confidence, 0) / values.length);
      return {
        fields: aiFields,
        overallConfidence,
        rawText: "[Vision OCR] Extracted successfully via AI Vision."
      };
    }

    // 2. Fallback to Tesseract OCR
    let worker;
    try {
      worker = await createWorker("eng+ara");
    } catch {
      worker = await createWorker("eng");
    }

    try {
      const { data } = await worker.recognize(buffer);
      const ocrText = data.text;
      const ocrFields = extractFromText(ocrText);
      for (const key of Object.keys(ocrFields)) {
        if (ocrFields[key].value) {
          ocrFields[key].confidence = 70;
          ocrFields[key].source = "ocr";
        }
      }
      const values = Object.values(ocrFields);
      const overallConfidence = values.length === 0 ? 0 : Math.round(values.reduce((sum, f) => sum + f.confidence, 0) / values.length);
      return {
        fields: ocrFields,
        overallConfidence,
        rawText: ocrText
      };
    } finally {
      await worker.terminate();
    }
  }

  // File is a PDF
  const textLayer = await extractTextLayer(buffer);
  const textFields = extractFromText(textLayer);

  const missingFields = Object.values(textFields).some((f) => f.value === null);
  let ocrText = "";
  let fields = textFields;
  let pageImages: Buffer[] = [];

  if (missingFields) {
    pageImages = await renderPagesToImages(buffer);
    if (pageImages.length > 0) {
      let worker;
      try {
        worker = await createWorker("eng+ara");
      } catch {
        worker = await createWorker("eng");
      }
      try {
        let combined = "";
        for (const image of pageImages) {
          const { data } = await worker.recognize(image);
          combined += `\n${data.text}`;
        }
        ocrText = combined;
        
        const ocrFields = extractFromText(ocrText);
        for (const key of Object.keys(ocrFields)) {
          if (ocrFields[key].value) {
            ocrFields[key].confidence = 75;
            ocrFields[key].source = "ocr";
          }
        }
        fields = mergeFields(textFields, ocrFields);
      } finally {
        await worker.terminate();
      }
    }
  }

  const stillMissing = Object.values(fields).some((f) => f.value === null);
  if (stillMissing && pageImages.length > 0) {
    const aiFields = await extractWithAiVision(pageImages);
    if (aiFields) fields = mergeFields(fields, aiFields);
  }

  const values = Object.values(fields);
  const overallConfidence =
    values.length === 0 ? 0 : Math.round(values.reduce((sum, f) => sum + f.confidence, 0) / values.length);

  return { fields, overallConfidence, rawText: `${textLayer}\n${ocrText}`.trim() };
}

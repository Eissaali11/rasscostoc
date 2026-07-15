import type { ConfidenceField } from "../domain/types.js";
import type { VisionFieldMap } from "./types.js";

const KNOWN_FIELDS = [
  "serial_number",
  "sim_serial",
  "tid",
  "merchant",
  "branch",
  "model",
  "manufacturer",
] as const;

function asConfidenceField(raw: unknown): ConfidenceField | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const confidence = o.confidence;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 100) return null;
  const value = o.value;
  if (!(typeof value === "string" || value === null)) return null;
  return { value, confidence };
}

/** Extract per-field { value, confidence } map from model JSON. */
export function extractConfidenceFields(json: Record<string, unknown>): VisionFieldMap {
  const fields: VisionFieldMap = {};
  for (const key of KNOWN_FIELDS) {
    if (key in json) {
      const field = asConfidenceField(json[key]);
      if (field) fields[key] = field;
    }
  }
  // Allow additional confidence-shaped fields (maintenance, etc.)
  for (const [key, val] of Object.entries(json)) {
    if (KNOWN_FIELDS.includes(key as (typeof KNOWN_FIELDS)[number])) continue;
    if (key === "device_id" || key === "device_index" || key === "extraction_confidence") continue;
    const field = asConfidenceField(val);
    if (field) fields[key] = field;
  }
  return fields;
}

export function averageFieldConfidence(fields: VisionFieldMap): number | undefined {
  const values = Object.values(fields).map((f) => f.confidence);
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

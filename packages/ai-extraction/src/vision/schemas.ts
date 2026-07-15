/**
 * Installation report device JSON Schema (draft-07 subset) — PR-006A-4.
 * Per-field { value, confidence }; multi-device handled by calling Vision once per device_id.
 */
export const INSTALLATION_DEVICE_SCHEMA_V3 = {
  $id: "installation.schema_v3",
  type: "object",
  additionalProperties: false,
  required: ["device_id"],
  properties: {
    device_id: { type: "string" },
    device_index: { type: "number" },
    serial_number: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    sim_serial: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    tid: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    merchant: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    branch: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    model: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    manufacturer: {
      type: "object",
      required: ["value", "confidence"],
      properties: {
        value: { type: ["string", "null"] },
        confidence: { type: "number", minimum: 0, maximum: 100 },
      },
      additionalProperties: false,
    },
    extraction_confidence: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  $id?: string;
};

export function schemaForDocumentType(document_type: string): JsonSchema {
  if (document_type === "installation_report") {
    return INSTALLATION_DEVICE_SCHEMA_V3 as unknown as JsonSchema;
  }
  // Generic review fallback — still confidence-shaped fields only
  return {
    type: "object",
    required: ["device_id"],
    additionalProperties: true,
    properties: {
      device_id: { type: "string" },
      extraction_confidence: { type: "number", minimum: 0, maximum: 100 },
    },
  };
}

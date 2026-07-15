import type { ConfidenceField, ImageRef } from "../domain/types.js";

export type VisionFieldMap = Record<string, ConfidenceField>;

export type DeviceVisionExtraction = {
  device_id: string;
  device_index?: number;
  ok: boolean;
  schema_valid: boolean;
  schema_version: string;
  prompt_version: string;
  provider_id: string;
  model?: string;
  fields: VisionFieldMap;
  extraction_confidence?: number;
  raw_json?: Record<string, unknown>;
  schema_errors: string[];
  error?: { code: string; message: string };
};

export type VisionExtractDeviceInput = {
  device_id: string;
  device_index?: number;
  document_type: string;
  schema_version: string;
  prompt_version: string;
  images: ImageRef[];
  /** Optional image bytes keyed by image_id — live Gemini needs pixels; fixtures may omit */
  image_payloads?: Array<{
    image_id?: string;
    mime_type: string;
    base64: string;
  }>;
  temperature?: number;
  response_schema?: Record<string, unknown>;
  system_prompt?: string;
};

export type MultiDeviceVisionRequest = {
  document_type: string;
  schema_version: string;
  prompt_version: string;
  devices: Array<{
    device_id: string;
    device_index?: number;
    images: ImageRef[];
    image_payloads?: VisionExtractDeviceInput["image_payloads"];
  }>;
  response_schema?: Record<string, unknown>;
  system_prompt?: string;
  temperature?: number;
};

export type MultiDeviceVisionResult = {
  document_type: string;
  schema_version: string;
  prompt_version: string;
  devices: DeviceVisionExtraction[];
};

import type { VisionProvider } from "../ports/providers.js";
import { averageFieldConfidence, extractConfidenceFields } from "./confidence.js";
import { buildDeviceExtractionPrompt } from "./prompts.js";
import { schemaForDocumentType } from "./schemas.js";
import { validateAgainstSchema } from "./schema-validate.js";
import type {
  DeviceVisionExtraction,
  MultiDeviceVisionRequest,
  MultiDeviceVisionResult,
} from "./types.js";

export type VisionExtractionServiceOptions = {
  provider: VisionProvider & { id?: string };
  providerId?: string;
  model?: string;
};

/**
 * Multi-device Vision Extraction orchestrator.
 * Calls Vision once per device_id, validates JSON schema, normalizes per-field confidence.
 */
export class VisionExtractionService {
  private readonly provider: VisionProvider & { id?: string };
  private readonly providerId: string;
  private readonly model?: string;

  constructor(opts: VisionExtractionServiceOptions) {
    this.provider = opts.provider;
    this.providerId = opts.providerId ?? opts.provider.id ?? "vision_provider";
    this.model = opts.model;
  }

  async extractAll(request: MultiDeviceVisionRequest): Promise<MultiDeviceVisionResult> {
    const schema = request.response_schema
      ? (request.response_schema as Parameters<typeof validateAgainstSchema>[1])
      : schemaForDocumentType(request.document_type);

    const devices: DeviceVisionExtraction[] = [];
    for (const device of request.devices) {
      const system_prompt =
        request.system_prompt ??
        buildDeviceExtractionPrompt({
          document_type: request.document_type,
          device_id: device.device_id,
          prompt_version: request.prompt_version,
        });

      const result = await this.provider.extractDevice({
        device_id: device.device_id,
        document_type: request.document_type,
        schema_version: request.schema_version,
        prompt_version: request.prompt_version,
        images: device.images,
        temperature: request.temperature ?? 0,
        image_payloads: device.image_payloads,
        response_schema: request.response_schema,
        system_prompt,
      });

      if (!result.ok) {
        devices.push({
          device_id: device.device_id,
          device_index: device.device_index,
          ok: false,
          schema_valid: false,
          schema_version: request.schema_version,
          prompt_version: request.prompt_version,
          provider_id: this.providerId,
          model: this.model,
          fields: {},
          schema_errors: [],
          error: { code: result.code, message: result.message },
        });
        continue;
      }

      const json: Record<string, unknown> = { ...result.json, device_id: device.device_id };
      const validation = validateAgainstSchema(json, schema);
      const fields = extractConfidenceFields(json);
      const extraction_confidence =
        typeof json.extraction_confidence === "number"
          ? json.extraction_confidence
          : averageFieldConfidence(fields);

      devices.push({
        device_id: device.device_id,
        device_index: device.device_index,
        ok: validation.valid,
        schema_valid: validation.valid,
        schema_version: request.schema_version,
        prompt_version: request.prompt_version,
        provider_id: this.providerId,
        model: this.model,
        fields,
        extraction_confidence,
        raw_json: json,
        schema_errors: validation.errors,
        error: validation.valid
          ? undefined
          : { code: "invalid_json", message: "Schema validation failed" },
      });
    }

    return {
      document_type: request.document_type,
      schema_version: request.schema_version,
      prompt_version: request.prompt_version,
      devices,
    };
  }
}

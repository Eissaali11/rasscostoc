import type { VisionExtractResult, VisionProvider, VisionProviderInput } from "../ports/providers.js";
import { buildDeviceExtractionPrompt } from "./prompts.js";
import { schemaForDocumentType } from "./schemas.js";
import {
  FetchGeminiHttpClient,
  type GeminiHttpClient,
} from "./gemini-http.js";

export type GeminiVisionAdapterOptions = {
  /** Must be true to allow network calls. Default false. */
  allowLive?: boolean;
  apiKey?: string;
  model?: string;
  http?: GeminiHttpClient;
  providerId?: string;
};

/**
 * Gemini Structured Output adapter implementing VisionProvider.
 * Live calls require allowLive=true + apiKey.
 * Never wire allowLive in production until ERP-003 Pass.
 */
export class GeminiVisionAdapter implements VisionProvider {
  readonly id: string;
  private readonly allowLive: boolean;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly http: GeminiHttpClient;

  constructor(opts: GeminiVisionAdapterOptions = {}) {
    this.id = opts.providerId ?? "gemini_vision_v1";
    this.allowLive = opts.allowLive === true;
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    this.http = opts.http ?? new FetchGeminiHttpClient();
  }

  async extractDevice(input: VisionProviderInput): Promise<VisionExtractResult> {
    if (!this.allowLive) {
      return {
        ok: false,
        code: "disabled",
        message: "GeminiVisionAdapter: allowLive=false (default). No network call.",
      };
    }
    if (!this.apiKey) {
      return {
        ok: false,
        code: "disabled",
        message: "GeminiVisionAdapter: missing GEMINI_API_KEY / apiKey",
      };
    }

    const prompt =
      input.system_prompt ??
      buildDeviceExtractionPrompt({
        document_type: input.document_type,
        device_id: input.device_id,
        prompt_version: input.prompt_version,
      });

    const responseSchema =
      input.response_schema ??
      (schemaForDocumentType(input.document_type) as unknown as Record<string, unknown>);

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];

    for (const payload of input.image_payloads ?? []) {
      parts.push({
        inlineData: { mimeType: payload.mime_type, data: payload.base64 },
      });
    }

    if ((input.image_payloads?.length ?? 0) === 0) {
      parts.push({
        text: `Images metadata (no pixels attached): ${JSON.stringify(input.images)}`,
      });
    }

    try {
      const { text } = await this.http.generateContent({
        model: this.model,
        apiKey: this.apiKey,
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: input.temperature ?? 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      });
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {
          ok: false,
          code: "invalid_json",
          message: "Gemini returned non-JSON content",
        };
      }
      if (!json.device_id) json.device_id = input.device_id;
      return { ok: true, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("abort")) {
        return { ok: false, code: "timeout", message };
      }
      return { ok: false, code: "provider_error", message };
    }
  }
}

import type { VisionProvider, VisionProviderInput, VisionExtractResult } from "../ports/providers.js";

export type OpenAiVisionAdapterOptions = {
  allowLive?: boolean;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export class OpenAiVisionAdapter implements VisionProvider {
  readonly id = "openai_vision_v1";
  private readonly allowLive: boolean;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: OpenAiVisionAdapterOptions = {}) {
    this.allowLive = opts.allowLive === true;
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = opts.model ?? "gpt-4o";
    this.timeoutMs = opts.timeoutMs ?? 90000;
  }

  async extractDevice(input: VisionProviderInput): Promise<VisionExtractResult> {
    if (!this.allowLive) {
      return { ok: false, code: "disabled", message: "OpenAiVisionAdapter: allowLive=false" };
    }
    if (!this.apiKey) {
      return { ok: false, code: "disabled", message: "OpenAiVisionAdapter: missing apiKey" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const contentParts: any[] = [{ type: "text", text: input.system_prompt || "" }];

      for (const payload of input.image_payloads ?? []) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${payload.mime_type};base64,${payload.base64}`,
          },
        });
      }

      if ((input.image_payloads?.length ?? 0) === 0) {
        contentParts.push({
          type: "text",
          text: `Images metadata: ${JSON.stringify(input.images)}`,
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: contentParts,
            },
          ],
          response_format: { type: "json_object" },
          temperature: input.temperature ?? 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as any;
      const textResult = data.choices?.[0]?.message?.content || "";

      let json: Record<string, unknown>;
      try {
        json = JSON.parse(textResult) as Record<string, unknown>;
      } catch {
        return {
          ok: false,
          code: "invalid_json",
          message: "OpenAI returned non-JSON content",
        };
      }

      if (!json.device_id) json.device_id = input.device_id;
      return { ok: true, json };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const message = err.message || String(err);
      if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout")) {
        return { ok: false, code: "timeout", message };
      }
      return { ok: false, code: "provider_error", message };
    }
  }
}

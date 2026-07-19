import type { VisionProvider, VisionProviderInput, VisionExtractResult } from "../ports/providers.js";

export type ClaudeVisionAdapterOptions = {
  allowLive?: boolean;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export class ClaudeVisionAdapter implements VisionProvider {
  readonly id = "claude_vision_v1";
  private readonly allowLive: boolean;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(opts: ClaudeVisionAdapterOptions = {}) {
    this.allowLive = opts.allowLive === true;
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.model = opts.model ?? "claude-3-5-sonnet-latest";
    this.timeoutMs = opts.timeoutMs ?? 90000;
  }

  async extractDevice(input: VisionProviderInput): Promise<VisionExtractResult> {
    if (!this.allowLive) {
      return { ok: false, code: "disabled", message: "ClaudeVisionAdapter: allowLive=false" };
    }
    if (!this.apiKey) {
      return { ok: false, code: "disabled", message: "ClaudeVisionAdapter: missing apiKey" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const contentParts: any[] = [];

      for (const payload of input.image_payloads ?? []) {
        contentParts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: payload.mime_type,
            data: payload.base64,
          },
        });
      }

      contentParts.push({
        type: "text",
        text: `Please extract all device and model installation details. Adhere strictly to the requested JSON structure.`,
      });

      // Convert OpenAPI 3.0 schema to Anthropics tool input schema format if necessary.
      // Anthropic requires lowercase properties.
      const properties: Record<string, any> = {};
      const responseSchema = input.response_schema || { properties: {} };
      
      const mapType = (t: string) => {
        if (t === "NUMBER") return "number";
        if (t === "STRING") return "string";
        if (t === "OBJECT") return "object";
        if (t === "ARRAY") return "array";
        if (t === "BOOLEAN") return "boolean";
        return t.toLowerCase();
      };

      const convertSchema = (s: any): any => {
        if (!s || typeof s !== "object") return s;
        const out: any = {};
        if (s.type) out.type = mapType(s.type);
        if (s.properties) {
          out.properties = {};
          for (const key of Object.keys(s.properties)) {
            out.properties[key] = convertSchema(s.properties[key]);
          }
        }
        if (s.items) out.items = convertSchema(s.items);
        if (s.required) out.required = s.required;
        return out;
      };

      const inputSchema = convertSchema(responseSchema);

      const tools = [
        {
          name: "record_extracted_devices",
          description: "Record all extracted devices and metadata from the document",
          input_schema: inputSchema,
        },
      ];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: contentParts,
            },
          ],
          system: input.system_prompt || "",
          max_tokens: 4000,
          temperature: input.temperature ?? 0,
          tools,
          tool_choice: { type: "tool", name: "record_extracted_devices" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as any;

      const toolUseBlock = data.content?.find(
        (c: any) => c.type === "tool_use" && c.name === "record_extracted_devices",
      );
      if (!toolUseBlock || !toolUseBlock.input) {
        throw new Error("Claude did not call the extraction tool or return tool_use input.");
      }

      const json = toolUseBlock.input as Record<string, unknown>;

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

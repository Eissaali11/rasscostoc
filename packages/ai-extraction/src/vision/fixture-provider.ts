import type { VisionExtractResult, VisionProvider } from "../ports/providers.js";

/**
 * Deterministic Vision provider for unit tests — no network.
 * Map device_id → JSON payload (or use default).
 */
export class FixtureVisionProvider implements VisionProvider {
  readonly id = "fixture_vision_v1";

  constructor(
    private readonly byDevice: Record<string, Record<string, unknown>> = {},
    private readonly defaultJson?: Record<string, unknown>,
  ) {}

  async extractDevice(input: {
    device_id: string;
    document_type: string;
    schema_version: string;
    prompt_version: string;
    images: unknown[];
  }): Promise<VisionExtractResult> {
    void input.document_type;
    void input.schema_version;
    void input.prompt_version;
    void input.images;
    const json = this.byDevice[input.device_id] ?? this.defaultJson;
    if (!json) {
      return {
        ok: false,
        code: "provider_error",
        message: `No fixture for device ${input.device_id}`,
      };
    }
    return { ok: true, json: { ...json, device_id: input.device_id } };
  }
}

/** Returns invalid JSON path via provider_error simulation of garbage handled upstream — helper for tests. */
export class InvalidJsonVisionProvider implements VisionProvider {
  readonly id = "invalid_json_vision_v1";

  async extractDevice(): Promise<VisionExtractResult> {
    return { ok: false, code: "invalid_json", message: "simulated invalid json" };
  }
}

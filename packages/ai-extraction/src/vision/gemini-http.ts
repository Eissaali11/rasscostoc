export type GeminiGenerateRequest = {
  model: string;
  apiKey: string;
  contents: Array<{
    role: "user" | "model";
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;
  }>;
  generationConfig: {
    temperature: number;
    responseMimeType: "application/json";
    responseSchema?: Record<string, unknown>;
  };
  timeoutMs?: number;
};

export type GeminiGenerateResponse = {
  text: string;
  raw: unknown;
};

export interface GeminiHttpClient {
  generateContent(req: GeminiGenerateRequest): Promise<GeminiGenerateResponse>;
}

/**
 * REST client for Gemini generateContent (Structured Output via responseMimeType).
 * PLATFORM-P0: API key is sent via `x-goog-api-key` header — never in the URL/query string.
 */
export class FetchGeminiHttpClient implements GeminiHttpClient {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  ) {}

  async generateContent(req: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:generateContent`;
    if (url.includes("?") || url.toLowerCase().includes("key=")) {
      throw new Error("Gemini client refused to send API key in URL");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": req.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: req.contents,
          generationConfig: req.generationConfig,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 400)}`);
      }
      const raw = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) {
        throw new Error("Gemini returned empty text");
      }
      return { text, raw };
    } finally {
      clearTimeout(timer);
    }
  }
}

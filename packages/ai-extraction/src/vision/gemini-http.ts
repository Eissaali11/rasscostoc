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
 * Injectable for tests — no SDK dependency required in the monorepo root.
 */
export class FetchGeminiHttpClient implements GeminiHttpClient {
  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  ) {}

  async generateContent(req: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

import {
  getActiveVisionCredentials,
  loadAiEngineSettings,
  saveAiEngineSettings,
  type AiConnectionTestSnapshot,
  type AiVisionProviderId,
} from "./ai-engine-settings.store";

export type ConnectionTestResult = AiConnectionTestSnapshot;

export type ConnectionTestInput = {
  provider?: AiVisionProviderId;
  model?: string;
  /** If provided, test this key without requiring it to be saved first. */
  apiKey?: string | null;
  timeoutMs?: number;
};

function classifyGeminiError(
  message: string,
): Pick<ConnectionTestResult, "ok" | "code" | "message" | "detail"> {
  const detail = message.slice(0, 280);
  const lower = message.toLowerCase();
  if (
    message.includes("401") ||
    message.includes("403") ||
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("permission denied") ||
    lower.includes("consumer_invalid") ||
    (lower.includes("api key") && (lower.includes("invalid") || lower.includes("denied")))
  ) {
    return {
      ok: false,
      code: "auth",
      message: "المفتاح غير صالح أو ليس لديه صلاحية الوصول إلى Gemini.",
      detail,
    };
  }
  // 429 = Google accepted the API key; only free-tier quota is exhausted.
  // For connection tests this means the key/link is VALID.
  if (message.includes("429") || lower.includes("quota") || lower.includes("rate")) {
    return {
      ok: true,
      code: "quota",
      message:
        "الربط صحيح والمفتاح مقبول من Gemini. الحصة المجانية الحالية ممتلئة مؤقتًا — انتظر إعادة التعبئة أو فعّل الفوترة لاستخدام الاستخراج فورًا.",
      detail,
    };
  }
  if (lower.includes("abort") || lower.includes("timeout")) {
    return {
      ok: false,
      code: "timeout",
      message: "انتهت مهلة الاتصال بمزود Gemini.",
      detail,
    };
  }
  return {
    ok: false,
    code: "provider_error",
    message: `فشل الاتصال: ${message.slice(0, 220)}`,
    detail,
  };
}

async function testGeminiConnection(args: {
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<Omit<ConnectionTestResult, "provider" | "model" | "testedAt">> {
  const started = Date.now();
  const { FetchGeminiHttpClient } = await import("@stockpro/ai-extraction");
  const http = new FetchGeminiHttpClient();

  try {
    const { text } = await http.generateContent({
      model: args.model,
      apiKey: args.apiKey,
      timeoutMs: Math.min(Math.max(args.timeoutMs, 5000), 30000),
      contents: [
        {
          role: "user",
          parts: [{ text: 'Reply with exactly this JSON: {"ok":true,"service":"gemini"}' }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const latencyMs = Date.now() - started;
    let parsed: { ok?: boolean } = {};
    try {
      parsed = JSON.parse(text) as { ok?: boolean };
    } catch {
      // Connectivity success if Gemini returned any content.
    }

    if (parsed.ok === false) {
      return {
        ok: false,
        latencyMs,
        code: "provider_error",
        message: "استجاب Gemini لكن الرد غير متوقع.",
      };
    }

    return {
      ok: true,
      latencyMs,
      code: "ok",
      message: `الربط يعمل بنجاح مع Gemini (${args.model}) خلال ${latencyMs}ms.`,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const classified = classifyGeminiError(raw);
    return {
      latencyMs: Date.now() - started,
      ...classified,
    };
  }
}

export function persistConnectionTestResult(result: ConnectionTestResult): void {
  const current = loadAiEngineSettings();
  saveAiEngineSettings({
    ...current,
    lastConnectionTest: result,
  });
}

export async function testAiEngineConnection(
  input: ConnectionTestInput = {},
): Promise<ConnectionTestResult> {
  const saved = getActiveVisionCredentials();
  const provider = (input.provider ?? saved.provider) as AiVisionProviderId;
  const model = input.model ?? saved.model;
  const apiKey =
    typeof input.apiKey === "string" && input.apiKey.trim()
      ? input.apiKey.trim()
      : saved.apiKey;
  const timeoutMs = input.timeoutMs ?? saved.timeoutMs ?? 20000;
  const testedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      ok: false,
      provider,
      model,
      latencyMs: 0,
      testedAt,
      code: "missing_key",
      message: "لا يوجد مفتاح API للاختبار. الصق المفتاح أولًا.",
    };
  }

  if (provider !== "gemini") {
    return {
      ok: false,
      provider,
      model,
      latencyMs: 0,
      testedAt,
      code: "unsupported",
      message: `اختبار الربط متاح حاليًا لـ Gemini فقط. المزود "${provider}" غير مربوط بعد.`,
    };
  }

  const partial = await testGeminiConnection({ apiKey, model, timeoutMs });
  const result: ConnectionTestResult = {
    provider,
    model,
    testedAt,
    ...partial,
  };

  persistConnectionTestResult(result);
  return result;
}

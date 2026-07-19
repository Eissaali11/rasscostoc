import {
  getActiveVisionCredentials,
  loadAiEngineSettings,
  saveAiEngineSettings,
  type AiConnectionTestSnapshot,
  type AiVisionProviderId,
} from "./ai-engine-settings.store";
import { FetchGeminiHttpClient } from "@stockpro/ai-extraction";

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
  // For connection tests this means the key/link is VALID but currently unusable.
  if (message.includes("429") || lower.includes("quota") || lower.includes("rate")) {
    return {
      ok: false,
      code: "quota",
      message:
        "المفتاح صحيح ومقبول من Gemini، ولكن الحصة المجانية الحالية ممتلئة مؤقتًا — انتظر إعادة التعبئة أو فعّل الفوترة لاستخدام الاستخراج فورًا.",
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

function classifyOpenAiError(
  message: string,
): Pick<ConnectionTestResult, "ok" | "code" | "message" | "detail"> {
  const detail = message.slice(0, 280);
  const lower = message.toLowerCase();
  if (
    message.includes("401") ||
    message.includes("403") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key")
  ) {
    return {
      ok: false,
      code: "auth",
      message: "المفتاح غير صالح أو ليس لديه صلاحية الوصول إلى OpenAI.",
      detail,
    };
  }
  if (message.includes("429") || lower.includes("quota") || lower.includes("rate limit")) {
    return {
      ok: false,
      code: "quota",
      message:
        "المفتاح صحيح ومقبول من OpenAI، ولكن الحصة الحالية ممتلئة مؤقتًا أو لا يوجد رصيد كافٍ — قم بشحن الرصيد في حساب OpenAI الخاص بك لاستخدام الاستخراج فورًا.",
      detail,
    };
  }
  if (lower.includes("abort") || lower.includes("timeout")) {
    return {
      ok: false,
      code: "timeout",
      message: "انتهت مهلة الاتصال بمزود OpenAI.",
      detail,
    };
  }
  return {
    ok: false,
    code: "provider_error",
    message: `فشل الاتصال بـ OpenAI: ${message.slice(0, 220)}`,
    detail,
  };
}

function classifyClaudeError(
  message: string,
): Pick<ConnectionTestResult, "ok" | "code" | "message" | "detail"> {
  const detail = message.slice(0, 280);
  const lower = message.toLowerCase();
  if (
    message.includes("401") ||
    message.includes("403") ||
    lower.includes("invalid client") ||
    lower.includes("api-key") ||
    lower.includes("authentication_error")
  ) {
    return {
      ok: false,
      code: "auth",
      message: "المفتاح غير صالح أو ليس لديه صلاحية الوصول إلى Claude (Anthropic).",
      detail,
    };
  }
  if (message.includes("429") || lower.includes("quota") || lower.includes("rate_limit")) {
    return {
      ok: false,
      code: "quota",
      message:
        "المفتاح صحيح ومقبول من Claude، ولكن الحصة الحالية ممتلئة مؤقتًا — انتظر إعادة التعبئة أو شحن الرصيد لاستخدام الاستخراج فورًا.",
      detail,
    };
  }
  if (lower.includes("abort") || lower.includes("timeout")) {
    return {
      ok: false,
      code: "timeout",
      message: "انتهت مهلة الاتصال بمزود Claude (Anthropic).",
      detail,
    };
  }
  return {
    ok: false,
    code: "provider_error",
    message: `فشل الاتصال بـ Claude: ${message.slice(0, 220)}`,
    detail,
  };
}

async function testGeminiConnection(args: {
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<Omit<ConnectionTestResult, "provider" | "model" | "testedAt">> {
  const started = Date.now();
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

async function testOpenAiConnection(args: {
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<Omit<ConnectionTestResult, "provider" | "model" | "testedAt">> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    return {
      ok: true,
      latencyMs,
      code: "ok",
      message: `الربط يعمل بنجاح مع OpenAI (${args.model}) خلال ${latencyMs}ms.`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const raw = err instanceof Error ? err.message : String(err);
    const classified = classifyOpenAiError(raw);
    return {
      latencyMs: Date.now() - started,
      ...classified,
    };
  }
}

async function testClaudeConnection(args: {
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<Omit<ConnectionTestResult, "provider" | "model" | "testedAt">> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    return {
      ok: true,
      latencyMs,
      code: "ok",
      message: `الربط يعمل بنجاح مع Claude (${args.model}) خلال ${latencyMs}ms.`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const raw = err instanceof Error ? err.message : String(err);
    const classified = classifyClaudeError(raw);
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

  let partial: Omit<ConnectionTestResult, "provider" | "model" | "testedAt">;
  if (provider === "gemini") {
    partial = await testGeminiConnection({ apiKey, model, timeoutMs });
  } else if (provider === "openai") {
    partial = await testOpenAiConnection({ apiKey, model, timeoutMs });
  } else if (provider === "claude") {
    partial = await testClaudeConnection({ apiKey, model, timeoutMs });
  } else {
    return {
      ok: false,
      provider,
      model,
      latencyMs: 0,
      testedAt,
      code: "unsupported",
      message: `اختبار الربط غير مدعوم للمزود "${provider}".`,
    };
  }

  const result: ConnectionTestResult = {
    provider,
    model,
    testedAt,
    ...partial,
  };

  persistConnectionTestResult(result);
  return result;
}

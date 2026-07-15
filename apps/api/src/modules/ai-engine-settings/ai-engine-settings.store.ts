import crypto from "crypto";
import fs from "fs";
import path from "path";

export type AiVisionProviderId = "gemini" | "openai" | "claude";

export type AiConnectionTestSnapshot = {
  ok: boolean;
  provider: AiVisionProviderId;
  model: string;
  latencyMs: number;
  testedAt: string;
  message: string;
  code?: string;
  detail?: string;
};

export type AiEngineSettings = {
  enabled: boolean;
  provider: AiVisionProviderId;
  model: string;
  /** Stored encrypted; never returned in clear text via API. */
  apiKeyEncrypted: string | null;
  hasApiKey: boolean;
  timeoutMs: number;
  updatedAt: string | null;
  updatedBy: string | null;
  lastConnectionTest?: AiConnectionTestSnapshot | null;
};

export type AiEngineSettingsPublic = {
  enabled: boolean;
  provider: AiVisionProviderId;
  model: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  timeoutMs: number;
  updatedAt: string | null;
  updatedBy: string | null;
  modelsByProvider: Record<AiVisionProviderId, string[]>;
  lastConnectionTest: AiConnectionTestSnapshot | null;
};

export const MODELS_BY_PROVIDER: Record<AiVisionProviderId, string[]> = {
  gemini: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
  claude: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
};

const DEFAULTS: AiEngineSettings = {
  enabled: false,
  provider: "gemini",
  model: "gemini-2.0-flash",
  apiKeyEncrypted: null,
  hasApiKey: false,
  timeoutMs: 60000,
  updatedAt: null,
  updatedBy: null,
  lastConnectionTest: null,
};

function settingsPath(): string {
  return path.resolve(process.cwd(), "data", "ai-engine-settings.json");
}

function secret(): string {
  return (
    process.env.AI_SETTINGS_SECRET ||
    process.env.SESSION_SECRET ||
    "dev-only-ai-settings-secret-change-me"
  );
}

function encrypt(plain: string): string {
  const key = crypto.createHash("sha256").update(secret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptApiKey(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const key = crypto.createHash("sha256").update(secret()).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

function maskKey(plain: string | null): string | null {
  if (!plain) return null;
  if (plain.length <= 8) return "••••••••";
  return `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}

function ensureDir(): void {
  const dir = path.dirname(settingsPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadAiEngineSettings(): AiEngineSettings {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AiEngineSettings>;
    return {
      ...DEFAULTS,
      ...raw,
      hasApiKey: Boolean(raw.apiKeyEncrypted),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAiEngineSettings(next: AiEngineSettings): void {
  ensureDir();
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
}

export function toPublicSettings(settings: AiEngineSettings): AiEngineSettingsPublic {
  const plain = decryptApiKey(settings.apiKeyEncrypted);
  const hasApiKey = settings.hasApiKey || Boolean(settings.apiKeyEncrypted);
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model,
    hasApiKey,
    apiKeyMasked: maskKey(plain) ?? (hasApiKey ? "••••••••" : null),
    timeoutMs: settings.timeoutMs,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
    modelsByProvider: MODELS_BY_PROVIDER,
    lastConnectionTest: settings.lastConnectionTest ?? null,
  };
}

export type UpdateAiEngineSettingsInput = {
  enabled?: boolean;
  provider?: AiVisionProviderId;
  model?: string;
  /** If omitted or empty, keep existing key. */
  apiKey?: string | null;
  clearApiKey?: boolean;
  timeoutMs?: number;
  updatedBy?: string | null;
};

export function updateAiEngineSettings(input: UpdateAiEngineSettingsInput): AiEngineSettings {
  const current = loadAiEngineSettings();
  const provider = input.provider ?? current.provider;
  let model = input.model ?? current.model;
  const allowed = MODELS_BY_PROVIDER[provider] || [];
  if (!allowed.includes(model)) {
    model = allowed[0] ?? model;
  }

  let apiKeyEncrypted = current.apiKeyEncrypted;
  if (input.clearApiKey) {
    apiKeyEncrypted = null;
  } else if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    apiKeyEncrypted = encrypt(input.apiKey.trim());
  }

  const next: AiEngineSettings = {
    enabled: input.enabled ?? current.enabled,
    provider,
    model,
    apiKeyEncrypted,
    hasApiKey: Boolean(apiKeyEncrypted),
    timeoutMs:
      typeof input.timeoutMs === "number" && input.timeoutMs >= 5000
        ? Math.min(300000, input.timeoutMs)
        : current.timeoutMs,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? current.updatedBy,
    // Keep last test unless key/provider/model changed enough to invalidate it.
    lastConnectionTest:
      input.clearApiKey ||
      (typeof input.apiKey === "string" && input.apiKey.trim()) ||
      (input.provider != null && input.provider !== current.provider) ||
      (input.model != null && input.model !== current.model)
        ? null
        : current.lastConnectionTest ?? null,
  };

  saveAiEngineSettings(next);
  return next;
}

/** Runtime helper for future Vision wiring — local/dev only until ERP-003 Pass. */
export function getActiveVisionCredentials(): {
  enabled: boolean;
  provider: AiVisionProviderId;
  model: string;
  apiKey: string | null;
  timeoutMs: number;
} {
  const s = loadAiEngineSettings();
  return {
    enabled: s.enabled,
    provider: s.provider,
    model: s.model,
    apiKey: decryptApiKey(s.apiKeyEncrypted),
    timeoutMs: s.timeoutMs,
  };
}

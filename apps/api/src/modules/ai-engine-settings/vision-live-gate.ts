/**
 * PLATFORM-P0 — Single source of truth for live Vision activation.
 *
 * Live calls require ALL of:
 * - runtime / package vision_live flag (AI_VISION_LIVE_ENABLED)
 * - admin settings enabled
 * - valid API key
 * - timeout within allowed bounds
 */

import {
  isAiExtractionEnabled,
  isVisionLiveProductionAllowed,
} from "@stockpro/ai-extraction";
import { getActiveVisionCredentials } from "./ai-engine-settings.store";

const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_RETRIES = 1;

export type VisionLiveDecision = {
  allowed: boolean;
  reason: string | null;
  provider: string | null;
  model: string | null;
  apiKey: string | null;
  timeoutMs: number;
  maxRetries: number;
  /** Passed to Vision adapters — true only when gate allows. */
  allowLive: boolean;
};

function isValidTimeout(timeoutMs: number): boolean {
  return Number.isFinite(timeoutMs) && timeoutMs >= MIN_TIMEOUT_MS && timeoutMs <= MAX_TIMEOUT_MS;
}

/**
 * Resolve whether a live Vision provider call may proceed.
 * Feature flags and admin settings cannot conflict: both must agree.
 */
export function resolveVisionLiveAccess(): VisionLiveDecision {
  const creds = getActiveVisionCredentials();
  const runtimeFlag = isVisionLiveProductionAllowed() || process.env.AI_VISION_LIVE_ENABLED === "true";
  const packageMaster = isAiExtractionEnabled();
  // Master package flag is optional OR; production live path requires vision_live flag.
  const flagOk = runtimeFlag || (packageMaster && process.env.AI_VISION_LIVE_ENABLED === "true");

  const base: VisionLiveDecision = {
    allowed: false,
    reason: null,
    provider: creds.provider,
    model: creds.model,
    apiKey: null,
    timeoutMs: creds.timeoutMs,
    maxRetries: DEFAULT_MAX_RETRIES,
    allowLive: false,
  };

  if (!flagOk) {
    return {
      ...base,
      reason: "AI Vision runtime flag is disabled (AI_VISION_LIVE_ENABLED / vision_live_production)",
    };
  }

  if (!creds.enabled) {
    return {
      ...base,
      reason: "AI Vision provider is not activated in admin settings",
    };
  }

  const key = typeof creds.apiKey === "string" ? creds.apiKey.trim() : "";
  if (!key) {
    return {
      ...base,
      reason: "AI Vision API key is missing or invalid",
    };
  }

  if (!isValidTimeout(creds.timeoutMs)) {
    return {
      ...base,
      reason: `AI Vision timeoutMs out of range (${MIN_TIMEOUT_MS}-${MAX_TIMEOUT_MS})`,
    };
  }

  // Conflict guard: settings enabled while package explicitly forbids live production
  // when env asks for live — already covered by flagOk. Extra: if settings enabled but
  // flags off, we already returned above.

  return {
    allowed: true,
    reason: null,
    provider: creds.provider,
    model: creds.model,
    apiKey: key,
    timeoutMs: creds.timeoutMs,
    maxRetries: DEFAULT_MAX_RETRIES,
    allowLive: true,
  };
}

/** Redact secrets from log / error strings. */
export function redactSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[REDACTED_API_KEY]")
    .replace(/sk-[0-9A-Za-z]{10,}/g, "[REDACTED_API_KEY]")
    .replace(/key=[^&\s"']+/gi, "key=[REDACTED]")
    .replace(/x-api-key["']?\s*[:=]\s*["']?[^"'\s]+/gi, "x-api-key=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
}

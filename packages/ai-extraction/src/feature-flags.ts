/**
 * ERP-006A / PLATFORM-P0 feature gate.
 * Defaults MUST remain false unless explicitly enabled via environment.
 * Live Vision requires: runtime flag + admin settings + valid key (see vision-live-gate).
 */
function envFlag(name: string): boolean {
  return process.env[name] === "true";
}

export const AI_EXTRACTION_FEATURE_FLAG = {
  /** Master switch — env: AI_EXTRACTION_ENABLED */
  get enabled(): boolean {
    return envFlag("AI_EXTRACTION_ENABLED");
  },
  /** Live Vision on production paths — env: AI_VISION_LIVE_ENABLED */
  get vision_live_production(): boolean {
    return envFlag("AI_VISION_LIVE_ENABLED");
  },
  package: "006A" as const,
  pr: "PR-006A-6" as const,
};

export function isAiExtractionEnabled(): boolean {
  return Boolean(AI_EXTRACTION_FEATURE_FLAG.enabled);
}

export function isVisionLiveProductionAllowed(): boolean {
  return Boolean(AI_EXTRACTION_FEATURE_FLAG.vision_live_production);
}

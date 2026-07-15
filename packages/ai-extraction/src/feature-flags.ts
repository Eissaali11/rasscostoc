/**
 * ERP-006A feature gate — production activation forbidden until ERP-003 Pass.
 * Defaults MUST remain false. Live Vision requires explicit adapter opts + API key,
 * never this master flag alone.
 */
export const AI_EXTRACTION_FEATURE_FLAG = {
  /** Master switch — remains false through PR-006A-6 */
  enabled: false,
  /** Live Gemini on production paths — always false here */
  vision_live_production: false,
  package: "006A" as const,
  pr: "PR-006A-6" as const,
};

export function isAiExtractionEnabled(): boolean {
  return Boolean(AI_EXTRACTION_FEATURE_FLAG.enabled);
}

export function isVisionLiveProductionAllowed(): boolean {
  return Boolean(AI_EXTRACTION_FEATURE_FLAG.vision_live_production);
}

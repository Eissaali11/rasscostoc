import {
  SIGNAL_WEIGHTS,
  type CascadeSignal,
  type DeviceMatchKeys,
  type MatchConfidenceBand,
} from "./types.js";

export function availableEvidenceMax(keys: DeviceMatchKeys): number {
  let max = 0;
  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS) as Array<
    [CascadeSignal, number]
  >) {
    const v = keys[signal as keyof DeviceMatchKeys];
    if (typeof v === "string" && v.length > 0) max += weight;
  }
  return max;
}

export function evidenceToConfidence(evidence_score: number, availableMax: number): number {
  if (availableMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((evidence_score / availableMax) * 100)));
}

export function classifyConfidenceBand(confidence: number): MatchConfidenceBand {
  if (confidence >= 95) return "auto_match_candidate";
  if (confidence >= 80) return "recommended_review";
  return "manual_review_required";
}

/**
 * Ambiguity score 0–100: higher = more ambiguous.
 * Based on competitor proximity to best confidence.
 */
export function computeAmbiguityScore(confidences: number[]): number {
  if (confidences.length <= 1) return 0;
  const sorted = [...confidences].sort((a, b) => b - a);
  const best = sorted[0]!;
  const second = sorted[1]!;
  const gap = best - second;
  if (gap >= 25) return 10;
  if (gap >= 15) return 35;
  if (gap >= 5) return 60;
  return 90;
}

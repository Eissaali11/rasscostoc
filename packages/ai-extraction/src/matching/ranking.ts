import {
  availableEvidenceMax,
  classifyConfidenceBand,
  computeAmbiguityScore,
  evidenceToConfidence,
} from "./confidence.js";
import {
  matchedReasonsFromSignals,
  rejectedReasonsForCandidate,
} from "./explainability.js";
import { CASCADE_ORDER, type CascadeSignal, type DeviceMatchKeys, type RankedMatchCandidate } from "./types.js";
import type { CascadeAccumulator } from "./cascade.js";

function candidateSort(a: RankedMatchCandidate, b: RankedMatchCandidate): number {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (a.technician_id !== b.technician_id) {
    return a.technician_id.localeCompare(b.technician_id);
  }
  if (a.request_id !== b.request_id) return a.request_id - b.request_id;
  return a.execution_id.localeCompare(b.execution_id);
}

/**
 * Deterministic ranking: confidence DESC, technician_id ASC, request_id ASC, execution_id ASC.
 */
export function rankCandidates(
  accumulators: Map<string, CascadeAccumulator>,
  keys: DeviceMatchKeys,
): RankedMatchCandidate[] {
  const prelim: RankedMatchCandidate[] = [];
  const availableMax = availableEvidenceMax(keys);

  for (const acc of accumulators.values()) {
    const evidence_score = acc.evidence_score;
    const confidence = evidenceToConfidence(evidence_score, availableMax);
    const hitSignals = acc.hitSignals;
    const missingKeys = CASCADE_ORDER.filter((s) => {
      const hasKey = !!keys[signalToKeyField(s)];
      return hasKey && !hitSignals.includes(s);
    });

    prelim.push({
      technician_id: acc.record.technician_id,
      technician_name: acc.record.technician_name,
      request_id: acc.record.request_id,
      execution_id: acc.record.execution_id,
      branch: acc.record.branch,
      city: acc.record.city,
      custody_state: acc.record.custody_state,
      installation_status: acc.record.installation_status,
      score: evidence_score,
      confidence,
      evidence_score,
      ambiguity_score: 0,
      confidence_band: classifyConfidenceBand(confidence),
      matched_reason: matchedReasonsFromSignals(hitSignals),
      rejected_reason: rejectedReasonsForCandidate({
        hitSignals,
        missingKeys,
        ambiguityHigh: false,
      }),
      signals: acc.signals,
    });
  }

  prelim.sort(candidateSort);
  const ambiguity_score = computeAmbiguityScore(prelim.map((c) => c.confidence));
  const ambiguityHigh = ambiguity_score >= 60;

  return prelim.map((c) => ({
    ...c,
    ambiguity_score,
    rejected_reason: ambiguityHigh
      ? Array.from(
          new Set([
            ...c.rejected_reason,
            ...rejectedReasonsForCandidate({
              hitSignals: c.signals.filter((s) => s.matched).map((s) => s.signal),
              missingKeys: [],
              ambiguityHigh: true,
            }),
          ]),
        )
      : c.rejected_reason,
  }));
}

function signalToKeyField(signal: CascadeSignal): keyof DeviceMatchKeys {
  return signal as keyof DeviceMatchKeys;
}

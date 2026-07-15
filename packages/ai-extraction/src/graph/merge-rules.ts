import type { ConfidenceField } from "../domain/types.js";
import type { MergeDecision } from "./types.js";

const HIGH = 85;

function norm(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim().toLowerCase();
  return t.length ? t : null;
}

function fieldValue(f?: ConfidenceField): string | null {
  return norm(f?.value ?? null);
}

export type MergeProbe = {
  device_id: string;
  serial_number?: ConfidenceField;
  sim_serial?: ConfidenceField;
  tid?: ConfidenceField;
};

/**
 * Cautious merge rules (ERP-006): never auto-merge.
 * At most emit merge_candidate when SN+SIM+TID all agree at high confidence.
 * Any doubt → keep_separate.
 */
export function evaluateMergeRules(devices: MergeProbe[]): MergeDecision[] {
  const decisions: MergeDecision[] = [];
  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const a = devices[i]!;
      const b = devices[j]!;
      const snA = fieldValue(a.serial_number);
      const snB = fieldValue(b.serial_number);
      const simA = fieldValue(a.sim_serial);
      const simB = fieldValue(b.sim_serial);
      const tidA = fieldValue(a.tid);
      const tidB = fieldValue(b.tid);

      if (!snA || !snB || snA !== snB) {
        decisions.push({
          left_device_id: a.device_id,
          right_device_id: b.device_id,
          decision: "keep_separate",
          reason: "sn_missing_or_mismatch",
          applied: false,
        });
        continue;
      }

      const snHigh =
        (a.serial_number?.confidence ?? 0) >= HIGH &&
        (b.serial_number?.confidence ?? 0) >= HIGH;
      const simAgree = simA && simB && simA === simB;
      const tidAgree = tidA && tidB && tidA === tidB;
      const simHigh =
        simAgree &&
        (a.sim_serial?.confidence ?? 0) >= HIGH &&
        (b.sim_serial?.confidence ?? 0) >= HIGH;
      const tidHigh =
        tidAgree &&
        (a.tid?.confidence ?? 0) >= HIGH &&
        (b.tid?.confidence ?? 0) >= HIGH;

      if (snHigh && simHigh && tidHigh) {
        decisions.push({
          left_device_id: a.device_id,
          right_device_id: b.device_id,
          decision: "merge_candidate",
          reason: "sn_sim_tid_all_match_high_confidence — NOT applied; Review required",
          applied: false,
        });
      } else {
        decisions.push({
          left_device_id: a.device_id,
          right_device_id: b.device_id,
          decision: "keep_separate",
          reason: "insufficient_agreement_or_confidence — split + Review",
          applied: false,
        });
      }
    }
  }
  return decisions;
}

import type { MatchingDataPorts } from "./repositories.js";
import {
  CASCADE_ORDER,
  SIGNAL_WEIGHTS,
  type CascadeSignal,
  type DeviceMatchKeys,
  type MatchRecord,
  type MatchSignalHit,
} from "./types.js";

function keyFor(record: MatchRecord): string {
  return `${record.technician_id}::${record.request_id}::${record.execution_id}`;
}

function queryForSignal(keys: DeviceMatchKeys, signal: CascadeSignal): string | null {
  switch (signal) {
    case "serial_number":
      return keys.serial_number ?? null;
    case "sim_serial":
      return keys.sim_serial ?? null;
    case "tid":
      return keys.tid ?? null;
    case "mobile":
      return keys.mobile ?? null;
    case "merchant":
      return keys.merchant ?? null;
    case "incident":
      return keys.incident ?? null;
    case "branch":
      return keys.branch ?? null;
    case "city":
      return keys.city ?? null;
  }
}

function recordMatchesSignal(record: MatchRecord, signal: CascadeSignal, query: string): boolean {
  const q = query.toLowerCase();
  const field = (() => {
    switch (signal) {
      case "serial_number":
        return record.serial_number;
      case "sim_serial":
        return record.sim_serial;
      case "tid":
        return record.tid;
      case "mobile":
        return record.mobile;
      case "merchant":
        return record.merchant;
      case "incident":
        return record.incident;
      case "branch":
        return record.branch;
      case "city":
        return record.city;
    }
  })();
  return !!field && field.trim().toLowerCase() === q;
}

export type CascadeAccumulator = {
  record: MatchRecord;
  hitSignals: CascadeSignal[];
  signals: MatchSignalHit[];
  evidence_score: number;
};

/**
 * Full cascade search — always walks all signals for complete evidence (deterministic).
 */
export async function runCascadeSearch(
  keys: DeviceMatchKeys,
  ports: MatchingDataPorts,
): Promise<Map<string, CascadeAccumulator>> {
  const acc = new Map<string, CascadeAccumulator>();

  for (const signal of CASCADE_ORDER) {
    const query = queryForSignal(keys, signal);
    if (!query) continue;

    const hits = await ports.executions.search({ [signal]: query });
    for (const record of hits) {
      if (!recordMatchesSignal(record, signal, query)) continue;
      const k = keyFor(record);
      const existing = acc.get(k);
      if (!existing) {
        acc.set(k, {
          record,
          hitSignals: [signal],
          signals: [{ signal, query, matched: true }],
          evidence_score: SIGNAL_WEIGHTS[signal],
        });
      } else if (!existing.hitSignals.includes(signal)) {
        existing.hitSignals.push(signal);
        existing.signals.push({ signal, query, matched: true });
        existing.evidence_score += SIGNAL_WEIGHTS[signal];
      }
    }
  }

  return acc;
}

export function maxEvidenceScore(): number {
  return Object.values(SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
}

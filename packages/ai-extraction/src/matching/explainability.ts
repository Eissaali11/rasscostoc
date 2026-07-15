import type { CascadeSignal, RankedMatchCandidate } from "./types.js";

const LABELS: Record<CascadeSignal, string> = {
  serial_number: "الرقم التسلسلي",
  sim_serial: "رقم الشريحة",
  tid: "رقم الجهاز TID",
  mobile: "رقم الجوال",
  merchant: "اسم التاجر",
  incident: "رقم البلاغ",
  branch: "الفرع",
  city: "المدينة",
};

export function matchedReasonsFromSignals(signals: CascadeSignal[]): string[] {
  return signals.map((s) => LABELS[s]);
}

export function buildExplanation(candidate: RankedMatchCandidate | null): string[] {
  if (!candidate) {
    return ["لا توجد مطابقة مرشحة", "درجة الثقة: 0%"];
  }
  const lines = ["تمت المطابقة بواسطة:"];
  for (const reason of candidate.matched_reason) {
    lines.push(`✓ ${reason}`);
  }
  if (candidate.matched_reason.length === 0) {
    lines.push("— لا إشارات مطابقة");
  }
  lines.push(`درجة الثقة: ${candidate.confidence}%`);
  return lines;
}

export function rejectedReasonsForCandidate(args: {
  hitSignals: CascadeSignal[];
  missingKeys: CascadeSignal[];
  ambiguityHigh: boolean;
}): string[] {
  const rejected: string[] = [];
  for (const m of args.missingKeys) {
    rejected.push(`لا تطابق على: ${LABELS[m]}`);
  }
  if (args.ambiguityHigh) {
    rejected.push("تعارض / تعدد مرشحين — يلزم مراجعة");
  }
  if (args.hitSignals.length === 0) {
    rejected.push("لا إشارات كافية للمطابقة");
  }
  return rejected;
}

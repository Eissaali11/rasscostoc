import type { AmbiguityMeta, RankedMatchCandidate } from "./types.js";

export function detectAmbiguity(candidates: RankedMatchCandidate[]): AmbiguityMeta {
  const codes: string[] = [];
  const messages: string[] = [];

  const techIds = new Set(candidates.map((c) => c.technician_id));
  const requestIds = new Set(candidates.map((c) => c.request_id));
  const branches = new Set(candidates.map((c) => c.branch.trim().toLowerCase()));
  const custody = new Set(
    candidates.map((c) => `${c.technician_id}::${c.custody_state}`.toLowerCase()),
  );

  const multiple_technicians = techIds.size > 1;
  const multiple_requests = requestIds.size > 1;
  const conflicting_branches = branches.size > 1;
  const multiple_custody_owners = custody.size > 1 && techIds.size > 1;

  // duplicate serial implied when multiple strong candidates share same top signals
  const top = candidates.filter((c) => c.confidence >= 80);
  const duplicate_serial =
    top.length > 1 &&
    top.every((c) => c.signals.some((s) => s.signal === "serial_number" && s.matched));

  if (multiple_technicians) {
    codes.push("MULTIPLE_TECHNICIANS");
    messages.push("أكثر من فني محتمل");
  }
  if (multiple_requests) {
    codes.push("MULTIPLE_REQUESTS");
    messages.push("أكثر من طلب محتمل");
  }
  if (conflicting_branches) {
    codes.push("CONFLICTING_BRANCHES");
    messages.push("تعارض في الفرع");
  }
  if (duplicate_serial) {
    codes.push("DUPLICATE_SERIAL_MATCH");
    messages.push("رقم تسلسلي يطابق أكثر من سجل");
  }
  if (multiple_custody_owners) {
    codes.push("MULTIPLE_CUSTODY_OWNERS");
    messages.push("أكثر من مالك للعهدة");
  }

  return {
    multiple_technicians,
    multiple_requests,
    conflicting_branches,
    duplicate_serial,
    multiple_custody_owners,
    codes,
    messages,
  };
}

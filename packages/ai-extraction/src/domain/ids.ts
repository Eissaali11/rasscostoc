/** ID helpers for Session / Attempt — isolated from Courier. */

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** e.g. extract_20260714_000231 */
export function createExtractionSessionId(now = new Date(), seq = 1): string {
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1, 2);
  const d = pad(now.getUTCDate(), 2);
  return `extract_${y}${m}${d}_${pad(seq, 6)}`;
}

/** e.g. attempt_1 */
export function createExtractionAttemptId(attemptNumber: number): string {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("attemptNumber must be a positive integer");
  }
  return `attempt_${attemptNumber}`;
}

export function createDeviceId(index: number): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error("device index must be a positive integer");
  }
  return `device-${index}`;
}

export function nowIso(now = new Date()): string {
  return now.toISOString();
}

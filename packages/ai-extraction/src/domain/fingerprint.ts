import { createHash } from "node:crypto";
import type { FingerprintInput, FingerprintResult } from "./types.js";

function normalizePart(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * fingerprint_v2 = SHA256(document_type | SN | SIM | TID | merchant | branch | model | manufacturer)
 * Missing parts omitted — never invent identifiers.
 */
export function computeDeviceFingerprint(input: FingerprintInput): FingerprintResult {
  const parts = [
    normalizePart(input.document_type),
    normalizePart(input.serial_number),
    normalizePart(input.sim_serial),
    normalizePart(input.tid),
    normalizePart(input.merchant),
    normalizePart(input.branch),
    normalizePart(input.model),
    normalizePart(input.manufacturer),
  ].filter((p): p is string => p != null);

  const payload = parts.join("|");
  const digest = createHash("sha256").update(payload, "utf8").digest("hex");
  return {
    device_fingerprint: `sha256:${digest}`,
    fingerprint_version: "fingerprint_v2",
  };
}

/**
 * DB-R10C.1 — Canonical tax-rate semantics.
 *
 * WHY THIS EXISTS
 * ----------------
 * DB-R10B.1 §2 found a real, live conflict between two representations
 * of "tax rate" in the codebase:
 *
 *   - tax_codes.rate (accounting.schema.ts), used directly as
 *     `taxable * taxRate` in the only active tax-calculation code path
 *     (accounting.service.ts:515, :954), with a coded default of 0.15 —
 *     i.e. FRACTIONAL semantics (0.15 = 15%).
 *
 *   - products.defaultTaxRate (inventory_v2.schema.ts), whose test
 *     fixtures use 15.0 / 15 — i.e. PERCENTAGE-POINTS semantics
 *     (15.0 = 15%) — but which, as of this SHA, is NOT read by any
 *     active calculation path (CreateRepresentativeSale.use-case.ts
 *     never references it).
 *
 * DB-R10B.1 selected the FRACTIONAL representation (0.15 = 15%) as the
 * single canonical semantic for the whole system, because it is the one
 * actually driving a live financial calculation today. This module
 * defines that canonical type, its validation rule, and a classifier for
 * existing/legacy values — WITHOUT touching any stored data (that is a
 * later, separately-authorized migration; see the DB-R10C.1 report §9).
 */

/** A tax rate in StockPro's canonical fractional representation: 0.15 = 15%. */
export type CanonicalTaxRate = number & { readonly __brand: "CanonicalTaxRate" };

/** Canonical validation range: 0% to 100%, expressed fractionally. */
export const CANONICAL_TAX_RATE_MIN = 0;
export const CANONICAL_TAX_RATE_MAX = 1;

/**
 * Validates and brands a value as a canonical fractional tax rate.
 * Throws if the value is outside [0, 1] — a value like `15` is almost
 * certainly a legacy percentage-points value and must go through
 * `classifyLegacyTaxRate` + an explicit, evidenced conversion decision,
 * never be silently accepted here.
 */
export function assertCanonicalTaxRate(value: number): CanonicalTaxRate {
  if (!Number.isFinite(value)) {
    throw new RangeError(`assertCanonicalTaxRate: value must be finite, got ${value}`);
  }
  if (value < CANONICAL_TAX_RATE_MIN || value > CANONICAL_TAX_RATE_MAX) {
    throw new RangeError(
      `assertCanonicalTaxRate: ${value} is outside the canonical fractional range ` +
        `[${CANONICAL_TAX_RATE_MIN}, ${CANONICAL_TAX_RATE_MAX}]. StockPro's canonical tax-rate ` +
        `semantic is fractional (0.15 = 15%), not percentage-points (15 = 15%). ` +
        `If this value came from existing/legacy data, use classifyLegacyTaxRate() first — ` +
        `do not divide by 100 automatically.`
    );
  }
  return value as CanonicalTaxRate;
}

/**
 * Classification of an existing/legacy tax-rate value, per DB-R10B.1 §2
 * and the DB-R10C.1 directive §6. This performs NO conversion — it only
 * classifies. Any actual conversion of stored data requires a separately
 * evidenced, guarded migration (DB-R10C.1 §7): ambiguous/invalid rows
 * must stop that migration, never be auto-cleaned.
 */
export type LegacyTaxRateClassification =
  | { kind: "CANONICAL_FRACTIONAL"; value: number }
  | { kind: "LEGACY_PERCENTAGE_POINTS"; value: number; impliedFractional: number }
  | { kind: "INVALID_OR_AMBIGUOUS"; value: number; reason: string };

export function classifyLegacyTaxRate(rawValue: unknown): LegacyTaxRateClassification {
  // Reject non-number types explicitly before coercion: `Number(null)` is
  // 0 and `Number(undefined)` is NaN, but neither is a genuine numeric
  // reading — silently coercing null/undefined/objects/booleans here
  // would misclassify missing data as a valid canonical rate of 0.
  if (typeof rawValue !== "number" && typeof rawValue !== "string") {
    return { kind: "INVALID_OR_AMBIGUOUS", value: NaN, reason: `unsupported input type: ${typeof rawValue}` };
  }
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    return { kind: "INVALID_OR_AMBIGUOUS", value: NaN, reason: "non-finite or non-numeric" };
  }
  if (value < 0) {
    return { kind: "INVALID_OR_AMBIGUOUS", value, reason: "negative rate" };
  }
  if (value > 100) {
    return { kind: "INVALID_OR_AMBIGUOUS", value, reason: "exceeds 100 — not a plausible rate in either representation" };
  }
  // 0 and 1 are inherently ambiguous in isolation (0% in both
  // representations; 1 could mean "1%" legacy or "100%" canonical) —
  // DB-R10B.1's boundary rule treats [0, 1] as canonical per §2's chosen
  // range, since the one live calculation path already treats values in
  // this range as fractional. Values strictly greater than 1 and at most
  // 100 are classified as legacy percentage-points, matching the actual
  // 15.0/15 test-fixture evidence found in DB-R10B.1.
  if (value >= CANONICAL_TAX_RATE_MIN && value <= CANONICAL_TAX_RATE_MAX) {
    return { kind: "CANONICAL_FRACTIONAL", value };
  }
  return {
    kind: "LEGACY_PERCENTAGE_POINTS",
    value,
    impliedFractional: value / 100,
  };
}

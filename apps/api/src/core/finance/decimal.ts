/**
 * DB-R10C.1 — Canonical decimal-safe financial primitives.
 *
 * WHY THIS EXISTS
 * ----------------
 * DB-R10A/A.1 proved that 100% of StockPro's 34 persisted monetary fields
 * are `doublePrecision` (IEEE-754 binary float), and that the previous
 * `round2()` helper (`Math.round((value + Number.EPSILON) * 100) / 100`)
 * is NOT symmetric for negative tie values:
 *
 *   round2(-1.005)  = -1.00   (WRONG — should be -1.01)
 *   round2(-2.675)  = -2.67   (WRONG — should be -2.68)
 *
 * while PostgreSQL's `numeric` ROUND() is symmetric ("round half away from
 * zero") in both directions. DB-R10B.1 selected ROUND HALF AWAY FROM ZERO
 * as StockPro's canonical financial rounding policy specifically so that
 * application-layer rounding matches what the database itself will do
 * once monetary columns move to `numeric` (DB-R10C.3+).
 *
 * SCOPE OF THIS FILE (DB-R10C.1 only)
 * ------------------------------------
 * - A canonical, decimal-exact rounding primitive that operates on decimal
 *   STRINGS via BigInt arithmetic — it never routes the rounding decision
 *   itself through a binary float, so it cannot reproduce the asymmetric
 *   bug above.
 * - A number-in/number-out COMPATIBILITY wrapper for existing call sites
 *   that still pass/receive `number`. This wrapper is explicitly
 *   compatibility-only: per DB-R10B.1 §11 and the current governance
 *   directive, a JS `number` can never be more precise than a binary
 *   float64 approximation, no matter how it was rounded. It must NOT be
 *   used as the basis for NEW financial arithmetic — only for keeping
 *   today's `round2()` call sites behaviorally correct until DB-R10C.3+
 *   moves the underlying columns (and their surrounding calculations) to
 *   `numeric`/decimal-string representations.
 * - Named scale constants for the 5 financial categories established in
 *   DB-R10B (§2-3): money amounts, unit prices, tax rates, financial
 *   averages, exchange rates.
 *
 * This file deliberately does NOT touch any of the 33 existing round2()
 * call sites in accounting.service.ts, does NOT change any schema/column
 * type, and does NOT alter CreateRepresentativeSale — those are DB-R10C.2+.
 */

/** Scale (digits after the decimal point) per DB-R10B §2-3 financial category. */
export const FINANCIAL_SCALE = {
  /** MONEY_AMOUNT — invoice/bill/payment totals, subtotals, tax amounts, discounts. numeric(14,2). */
  MONEY_AMOUNT: 2,
  /** UNIT_PRICE — per-unit price/cost. numeric(14,4). */
  UNIT_PRICE: 4,
  /** TAX_RATE — canonical fractional rate (0.15 = 15%, see taxRate.ts). numeric(6,4) / numeric(5,4). */
  TAX_RATE: 4,
  /** FINANCIAL_AVERAGE — cumulative averages such as avg_selling_price. numeric(14,4). */
  FINANCIAL_AVERAGE: 4,
  /** EXCHANGE_RATE — currency exchange rate. numeric(12,6). */
  EXCHANGE_RATE: 6,
} as const;

export type FinancialScaleCategory = keyof typeof FINANCIAL_SCALE;

/**
 * Canonical decimal-exact rounding: ROUND HALF AWAY FROM ZERO.
 *
 * Operates entirely on the decimal STRING representation via BigInt —
 * never converts to/through a binary float during the rounding decision.
 * This is the one true canonical implementation; every other rounding
 * path in this file (and, eventually, every financial call site in the
 * codebase) should reduce to this function.
 *
 * @param decimal a finite decimal number written as a plain string, e.g.
 *   "1.005", "-2.675", "114.9885". Scientific notation is not accepted
 *   (financial inputs must never originate as scientific notation).
 * @param scale number of digits to keep after the decimal point (>= 0).
 * @returns the rounded value as a decimal string, always showing exactly
 *   `scale` digits after the point (e.g. "1.01", "-1.01", "5.00").
 */
export function roundHalfAwayFromZero(decimal: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError(`roundHalfAwayFromZero: scale must be a non-negative integer, got ${scale}`);
  }
  const trimmed = decimal.trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) {
    throw new TypeError(`roundHalfAwayFromZero: "${decimal}" is not a plain decimal string`);
  }
  const negative = match[1] === "-";
  const intPart = match[2];
  const fracPart = match[3] ?? "";

  // Pad the fractional part so we always have at least `scale + 1` digits
  // to inspect (the extra digit is the one that decides the tie).
  const paddedFrac = fracPart.padEnd(scale + 1, "0");
  const keptFrac = paddedFrac.slice(0, scale);
  const decidingDigit = paddedFrac.charAt(scale);

  // Combine integer + kept fractional digits into a single BigInt.
  let magnitude = BigInt(intPart + keptFrac || "0");

  // "Half away from zero": round up the magnitude whenever the first
  // digit being dropped is >= 5, regardless of sign — the sign is
  // re-applied afterwards, which is exactly what makes this symmetric
  // (unlike Math.round(value + EPSILON), which only ever nudges the
  // value upward on the number line, breaking symmetry for negatives).
  if (decidingDigit >= "5") {
    magnitude += 1n;
  }

  const magnitudeStr = magnitude.toString().padStart(scale + 1, "0");
  const newIntPart = magnitudeStr.slice(0, magnitudeStr.length - scale) || "0";
  const newFracPart = scale > 0 ? magnitudeStr.slice(magnitudeStr.length - scale) : "";

  const isZero = BigInt(newIntPart) === 0n && BigInt(newFracPart || "0") === 0n;
  const sign = negative && !isZero ? "-" : "";

  return scale > 0 ? `${sign}${newIntPart}.${newFracPart}` : `${sign}${newIntPart}`;
}

/**
 * COMPATIBILITY-ONLY wrapper: rounds a JS `number` using the canonical
 * ROUND HALF AWAY FROM ZERO policy and returns a `number`.
 *
 * IMPORTANT — read before using this in new code:
 * A JS `number` financial value has, by the time it reaches this
 * function, already lost exact decimal meaning (DB-R10A §6, DB-R10B.1
 * §1) — it is a binary float64 approximation, not the original decimal
 * the business intended. `toPrecision(15)` is applied first specifically
 * to recover the intended short decimal literal in the overwhelmingly
 * common case (typed literals like `1.005`, arithmetic results like
 * `33.33 * 3 * 1.15`) — float64 carries ~15-17 significant decimal
 * digits, so re-rendering at 15 significant digits collapses the
 * trailing binary noise (`114.98849999999999` -> `114.98500000000...`
 * is NOT what happens here; rather `1.00499999999999989` -> `1.00500000000000`,
 * recovering the tie exactly). This is a heuristic that matches the
 * DB-R10B.1 test matrix, not a mathematical guarantee for arbitrary
 * inputs — which is exactly why this is compatibility-only.
 *
 * Do NOT use this as the basis for NEW financial arithmetic. New code
 * that has access to a precise decimal source (a `numeric` column read
 * as a string, or a value never round-tripped through `number`) must
 * call `roundHalfAwayFromZero` directly on the string.
 */
export function roundDecimalCompat(value: number, scale: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundDecimalCompat: value must be finite, got ${value}`);
  }
  const recovered = value.toPrecision(15);
  const rounded = roundHalfAwayFromZero(normalizeToPlainDecimal(recovered), scale);
  return Number(rounded);
}

/** Converts a possibly-exponential decimal string (from toPrecision) to plain decimal notation. */
function normalizeToPlainDecimal(s: string): string {
  if (!/e/i.test(s)) return s;
  // toPrecision(15) can emit exponential notation for very large/small
  // magnitudes; Number(...).toString() round-trips those back to plain
  // notation safely for the financial magnitude ranges DB-R10A found
  // (max ~10^12), so this branch is a defensive fallback, not the
  // expected path for normal invoice-scale values.
  return Number(s).toString();
}

/**
 * Legacy-compatible drop-in replacement for the pre-existing
 * `round2(value: number): number` in accounting.service.ts.
 * Rounds to 2 decimal places (FINANCIAL_SCALE.MONEY_AMOUNT) using the
 * canonical symmetric policy. See `roundDecimalCompat` for the
 * compatibility-only caveat — this exists solely so the 33 existing
 * round2() call sites (inventoried in the DB-R10C.1 report) get
 * corrected symmetric behavior via a single one-line change at the
 * round2() definition, without touching each call site individually.
 */
export function round2Compat(value: number): number {
  return roundDecimalCompat(value, FINANCIAL_SCALE.MONEY_AMOUNT);
}

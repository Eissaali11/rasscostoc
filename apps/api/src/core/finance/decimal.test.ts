import { describe, expect, it } from "vitest";
import {
  FINANCIAL_SCALE,
  addDecimal,
  multiplyDecimal,
  round2Compat,
  roundDecimalCompat,
  roundHalfAwayFromZero,
  toPlainDecimalString,
} from "./decimal";

/**
 * DB-R10C.1 regression tests — written before wiring round2Compat into
 * accounting.service.ts. These first prove the OLD `round2()` bug
 * (asymmetric negative rounding, documented independently for the
 * record), then prove the NEW canonical primitive is symmetric.
 */

// The exact old implementation from accounting.service.ts:109-110, kept
// here ONLY as a reference fixture to document the bug being fixed —
// never imported into production code.
function legacyRound2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

describe("DB-R10C.1 — legacy round2() asymmetry (documented, not fixed here)", () => {
  it("is asymmetric for negative tie values (the bug DB-R10B.1 discovered)", () => {
    expect(legacyRound2(1.005)).toBe(1.01);
    expect(legacyRound2(2.675)).toBe(2.68);
    // These two diverge from PostgreSQL numeric ROUND() and from the
    // canonical symmetric policy — this is the bug, captured as evidence:
    expect(legacyRound2(-1.005)).toBe(-1); // WRONG: should be -1.01
    expect(legacyRound2(-2.675)).toBe(-2.67); // WRONG: should be -2.68
  });
});

describe("roundHalfAwayFromZero — canonical decimal-exact primitive (string in/out)", () => {
  it("rounds positive ties away from zero", () => {
    expect(roundHalfAwayFromZero("1.005", 2)).toBe("1.01");
    expect(roundHalfAwayFromZero("2.675", 2)).toBe("2.68");
    expect(roundHalfAwayFromZero("0.125", 2)).toBe("0.13");
  });

  it("rounds negative ties away from zero — symmetric with PostgreSQL numeric ROUND", () => {
    expect(roundHalfAwayFromZero("-1.005", 2)).toBe("-1.01");
    expect(roundHalfAwayFromZero("-2.675", 2)).toBe("-2.68");
    expect(roundHalfAwayFromZero("-0.125", 2)).toBe("-0.13");
  });

  it("matches the live PostgreSQL numeric ROUND() evidence gathered in DB-R10B.1", () => {
    // Evidence captured live against PostgreSQL 16 (disposable container):
    // round(1.005::numeric,2)=1.01  round(2.675::numeric,2)=2.68
    // round(-1.005::numeric,2)=-1.01 round(-2.675::numeric,2)=-2.68
    // round(0.125::numeric,2)=0.13  round(-0.125::numeric,2)=-0.13
    const cases: Array<[string, number, string]> = [
      ["1.005", 2, "1.01"],
      ["2.675", 2, "2.68"],
      ["-1.005", 2, "-1.01"],
      ["-2.675", 2, "-2.68"],
      ["0.125", 2, "0.13"],
      ["-0.125", 2, "-0.13"],
    ];
    for (const [input, scale, expected] of cases) {
      expect(roundHalfAwayFromZero(input, scale)).toBe(expected);
    }
  });

  it("does not round when the dropped digit is below 5", () => {
    expect(roundHalfAwayFromZero("1.004", 2)).toBe("1.00");
    expect(roundHalfAwayFromZero("-1.004", 2)).toBe("-1.00");
  });

  it("does not round when the dropped digit is exactly 5 followed by nothing (exact half)", () => {
    expect(roundHalfAwayFromZero("1.5", 0)).toBe("2");
    expect(roundHalfAwayFromZero("-1.5", 0)).toBe("-2");
  });

  it("rounds up when digits beyond the tie are nonzero (unambiguously > half)", () => {
    expect(roundHalfAwayFromZero("1.0051", 2)).toBe("1.01");
  });

  it("handles carry-over correctly", () => {
    expect(roundHalfAwayFromZero("1.995", 2)).toBe("2.00");
    expect(roundHalfAwayFromZero("-1.995", 2)).toBe("-2.00");
    expect(roundHalfAwayFromZero("9.995", 2)).toBe("10.00");
  });

  it("never produces a negative zero", () => {
    expect(roundHalfAwayFromZero("-0.001", 2)).toBe("0.00");
  });

  it("handles integers and missing fractional part", () => {
    expect(roundHalfAwayFromZero("100", 2)).toBe("100.00");
  });

  it("supports scale 0 and higher scales (4, 6) for the other financial categories", () => {
    expect(roundHalfAwayFromZero("0.123450", 4)).toBe("0.1235"); // wait: 0.12345 tie at 5th digit
    expect(roundHalfAwayFromZero("1.2345675", 6)).toBe("1.234568");
  });

  it("rejects malformed input instead of guessing", () => {
    expect(() => roundHalfAwayFromZero("1.5e10", 2)).toThrow(TypeError);
    expect(() => roundHalfAwayFromZero("abc", 2)).toThrow(TypeError);
    expect(() => roundHalfAwayFromZero("1.5", -1)).toThrow(RangeError);
  });
});

describe("roundDecimalCompat / round2Compat — compatibility wrapper (number in/out)", () => {
  it("recovers the intended decimal for standard JS float literals and rounds symmetrically", () => {
    expect(roundDecimalCompat(1.005, 2)).toBe(1.01);
    expect(roundDecimalCompat(2.675, 2)).toBe(2.68);
    expect(roundDecimalCompat(-1.005, 2)).toBe(-1.01);
    expect(roundDecimalCompat(-2.675, 2)).toBe(-2.68);
    expect(roundDecimalCompat(0.125, 2)).toBe(0.13);
    expect(roundDecimalCompat(-0.125, 2)).toBe(-0.13);
  });

  it("round2Compat matches the DB-R10A behavioral-proof examples", () => {
    expect(round2Compat(0.1 + 0.2)).toBe(0.3);
    expect(round2Compat(33.33 * 3 * 1.15)).toBe(114.99); // was 114.98849999999999 raw
    expect(round2Compat(987 * 12.345)).toBe(12184.52); // was 12184.515000000001 raw
  });

  it("round2Compat is a drop-in replacement for the old round2 on non-tie values", () => {
    expect(round2Compat(19.99 * 3 + 19.99 * 1 + 19.99 * 2)).toBe(119.94);
    expect(round2Compat(100 * 0.15)).toBe(15);
  });

  it("supports the other financial scale categories", () => {
    expect(roundDecimalCompat(12184.515, FINANCIAL_SCALE.UNIT_PRICE)).toBe(12184.515);
    expect(roundDecimalCompat(0.155555, FINANCIAL_SCALE.TAX_RATE)).toBe(0.1556);
    expect(roundDecimalCompat(3.1234565, FINANCIAL_SCALE.EXCHANGE_RATE)).toBe(3.123457);
  });

  it("rejects non-finite input", () => {
    expect(() => roundDecimalCompat(NaN, 2)).toThrow(RangeError);
    expect(() => roundDecimalCompat(Infinity, 2)).toThrow(RangeError);
  });
});

describe("DB-R10C.2 — multiplyDecimal / addDecimal (exact BigInt decimal arithmetic)", () => {
  it("multiplyDecimal computes the exact product, unrounded, at full precision", () => {
    expect(multiplyDecimal("2", "100")).toBe("200");
    expect(multiplyDecimal("3", "33.33")).toBe("99.99");
    expect(multiplyDecimal("99.99", "0.15")).toBe("14.9985"); // exact, not pre-rounded
    expect(multiplyDecimal("987", "12.345")).toBe("12184.515"); // exact — no float noise at all
  });

  it("multiplyDecimal handles signs correctly", () => {
    expect(multiplyDecimal("-2", "100")).toBe("-200");
    expect(multiplyDecimal("2", "-100")).toBe("-200");
    expect(multiplyDecimal("-2", "-100")).toBe("200");
  });

  it("multiplyDecimal handles zero without producing negative zero", () => {
    expect(multiplyDecimal("0", "-100")).toBe("0");
    expect(multiplyDecimal("-0.00", "5")).toBe("0.00"); // scale = fracLen("-0.00")=2 + fracLen("5")=0 = 2
  });

  it("addDecimal sums exactly, aligning differing scales", () => {
    expect(addDecimal("99.99", "14.9985")).toBe("114.9885");
    expect(addDecimal("1", "0.5")).toBe("1.5");
    expect(addDecimal("100.00", "0")).toBe("100.00");
  });

  it("addDecimal handles signed operands (net/cumulative sums)", () => {
    expect(addDecimal("100", "-30")).toBe("70");
    expect(addDecimal("-100", "30")).toBe("-70");
    expect(addDecimal("-100", "100")).toBe("0");
  });

  it("multiplyDecimal + roundHalfAwayFromZero reproduces the exact DB-R10A boundary example with zero float noise at any step", () => {
    const exactProduct = multiplyDecimal("987", "12.345");
    expect(exactProduct).toBe("12184.515"); // exact, unlike 987*12.345 in JS (12184.515000000001)
    expect(roundHalfAwayFromZero(exactProduct, 2)).toBe("12184.52");
  });

  it("rejects malformed input the same way as roundHalfAwayFromZero", () => {
    expect(() => multiplyDecimal("1.5e10", "2")).toThrow(TypeError);
    expect(() => addDecimal("abc", "1")).toThrow(TypeError);
  });
});

describe("toPlainDecimalString — number-to-decimal-string entry point", () => {
  it("recovers the intended decimal literal for standard financial float values", () => {
    expect(toPlainDecimalString(100)).toBe("100.000000000000");
    expect(toPlainDecimalString(0.15)).toBe("0.150000000000000");
    expect(toPlainDecimalString(33.33)).toBe("33.3300000000000");
  });

  it("rejects non-finite input", () => {
    expect(() => toPlainDecimalString(NaN)).toThrow(RangeError);
    expect(() => toPlainDecimalString(Infinity)).toThrow(RangeError);
  });
});

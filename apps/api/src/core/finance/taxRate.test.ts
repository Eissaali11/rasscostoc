import { describe, expect, it } from "vitest";
import {
  assertCanonicalTaxRate,
  classifyLegacyTaxRate,
  CANONICAL_TAX_RATE_MAX,
  CANONICAL_TAX_RATE_MIN,
} from "./taxRate";

describe("assertCanonicalTaxRate — canonical fractional writes", () => {
  it("accepts values within [0, 1]", () => {
    expect(assertCanonicalTaxRate(0)).toBe(0);
    expect(assertCanonicalTaxRate(0.15)).toBe(0.15);
    expect(assertCanonicalTaxRate(1)).toBe(1);
  });

  it("rejects legacy percentage-points values like 15", () => {
    expect(() => assertCanonicalTaxRate(15)).toThrow(RangeError);
    expect(() => assertCanonicalTaxRate(100)).toThrow(RangeError);
  });

  it("rejects negative and non-finite values", () => {
    expect(() => assertCanonicalTaxRate(-0.01)).toThrow(RangeError);
    expect(() => assertCanonicalTaxRate(NaN)).toThrow(RangeError);
    expect(() => assertCanonicalTaxRate(Infinity)).toThrow(RangeError);
  });

  it("boundary constants are 0 and 1", () => {
    expect(CANONICAL_TAX_RATE_MIN).toBe(0);
    expect(CANONICAL_TAX_RATE_MAX).toBe(1);
  });
});

describe("classifyLegacyTaxRate — existing/legacy data classification (no conversion performed)", () => {
  it("classifies canonical fractional values", () => {
    expect(classifyLegacyTaxRate(0.15)).toEqual({ kind: "CANONICAL_FRACTIONAL", value: 0.15 });
    expect(classifyLegacyTaxRate(0)).toEqual({ kind: "CANONICAL_FRACTIONAL", value: 0 });
    expect(classifyLegacyTaxRate(1)).toEqual({ kind: "CANONICAL_FRACTIONAL", value: 1 }); // upper boundary
  });

  it("classifies the known live legacy percentage-points fixtures (15.0, 100.0) without converting", () => {
    expect(classifyLegacyTaxRate(15.0)).toEqual({
      kind: "LEGACY_PERCENTAGE_POINTS",
      value: 15,
      impliedFractional: 0.15,
    });
    expect(classifyLegacyTaxRate(100.0)).toEqual({
      kind: "LEGACY_PERCENTAGE_POINTS",
      value: 100,
      impliedFractional: 1,
    });
  });

  it("classifies out-of-range values as invalid/ambiguous, never auto-corrected", () => {
    expect(classifyLegacyTaxRate(-1).kind).toBe("INVALID_OR_AMBIGUOUS");
    expect(classifyLegacyTaxRate(101).kind).toBe("INVALID_OR_AMBIGUOUS");
    expect(classifyLegacyTaxRate(NaN).kind).toBe("INVALID_OR_AMBIGUOUS");
    expect(classifyLegacyTaxRate("not-a-number").kind).toBe("INVALID_OR_AMBIGUOUS");
    expect(classifyLegacyTaxRate(undefined).kind).toBe("INVALID_OR_AMBIGUOUS");
    expect(classifyLegacyTaxRate(null).kind).toBe("INVALID_OR_AMBIGUOUS");
  });

  it("never mutates or divides input — classification only", () => {
    const result = classifyLegacyTaxRate(15);
    expect(result.kind).toBe("LEGACY_PERCENTAGE_POINTS");
    if (result.kind === "LEGACY_PERCENTAGE_POINTS") {
      expect(result.value).toBe(15); // original value preserved
      expect(result.impliedFractional).toBe(0.15); // conversion only *proposed*, not applied anywhere
    }
  });
});

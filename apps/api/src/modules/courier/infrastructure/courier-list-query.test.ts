import { describe, expect, it } from "vitest";
import {
  buildSmartSearchCondition,
  isIdentifierQuery,
  normalizeDigits,
  normalizeSearchQuery,
} from "./courier-list-query";

describe("ERP-001 smart search", () => {
  it("normalizes whitespace", () => {
    expect(normalizeSearchQuery("  ahmed   ali ")).toBe("ahmed ali");
  });

  it("detects identifier queries", () => {
    expect(isIdentifierQuery("853328252")).toBe(true);
    expect(isIdentifierQuery("SN-ABC-12")).toBe(true);
    expect(isIdentifierQuery("ahmed ali")).toBe(false);
    expect(isIdentifierQuery("ab")).toBe(false);
  });

  it("strips non-digits for mobile/tid variants", () => {
    expect(normalizeDigits("05-1234-5678")).toBe("0512345678");
  });

  it("builds a condition for identifier and name queries", () => {
    expect(buildSmartSearchCondition("8533")).toBeTruthy();
    expect(buildSmartSearchCondition("أحمد")).toBeTruthy();
    expect(buildSmartSearchCondition("   ")).toBeUndefined();
  });
});

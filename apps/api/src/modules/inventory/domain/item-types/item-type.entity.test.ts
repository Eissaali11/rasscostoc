import { describe, expect, it } from "vitest";
import {
  assertUniqueItemTypeNames,
  assertValidItemType,
  DuplicateItemTypeNameError,
  InvalidItemTypeError,
  normalizeItemTypeName,
  sanitizeItemTypeNames,
} from "./item-type.entity";

describe("ItemType domain rules", () => {
  it("normalizes names by trimming and lower-casing", () => {
    expect(normalizeItemTypeName("  TesT Name  ")).toBe("test name");
  });

  it("sanitizes item type names by trimming", () => {
    const sanitized = sanitizeItemTypeNames({
      nameAr: "  عربي  ",
      nameEn: "  English  ",
      unitsPerBox: 10,
    });

    expect(sanitized.nameAr).toBe("عربي");
    expect(sanitized.nameEn).toBe("English");
  });

  it("throws when names are empty", () => {
    expect(() =>
      assertValidItemType({
        nameAr: "   ",
        nameEn: "Valid",
        unitsPerBox: 10,
      })
    ).toThrowError(InvalidItemTypeError);

    expect(() =>
      assertValidItemType({
        nameAr: "صنف",
        nameEn: "   ",
        unitsPerBox: 10,
      })
    ).toThrowError(InvalidItemTypeError);
  });

  it("throws when unitsPerBox is not a positive integer", () => {
    expect(() =>
      assertValidItemType({
        nameAr: "صنف",
        nameEn: "Type",
        unitsPerBox: 0,
      })
    ).toThrowError(InvalidItemTypeError);

    expect(() =>
      assertValidItemType({
        nameAr: "صنف",
        nameEn: "Type",
        unitsPerBox: 2.5,
      })
    ).toThrowError(InvalidItemTypeError);
  });

  it("detects duplicate Arabic name case-insensitively", () => {
    expect(() =>
      assertUniqueItemTypeNames(
        [{ id: "1", nameAr: " صنف ", nameEn: "Type A" }],
        { id: "2", nameAr: "صنف", nameEn: "Type B" }
      )
    ).toThrowError(DuplicateItemTypeNameError);
  });

  it("detects duplicate English name case-insensitively", () => {
    expect(() =>
      assertUniqueItemTypeNames(
        [{ id: "1", nameAr: "صنف A", nameEn: " type-a " }],
        { id: "2", nameAr: "صنف B", nameEn: "TYPE-A" }
      )
    ).toThrowError(DuplicateItemTypeNameError);
  });

  it("allows same record when excluded by id", () => {
    expect(() =>
      assertUniqueItemTypeNames(
        [{ id: "1", nameAr: "صنف", nameEn: "Type" }],
        { id: "1", nameAr: "صنف", nameEn: "Type" },
        { excludeId: "1" }
      )
    ).not.toThrow();
  });
});

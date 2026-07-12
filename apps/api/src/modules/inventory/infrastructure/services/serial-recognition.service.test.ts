import { describe, it, expect } from "vitest";
import { SerialRecognitionService } from "./serial-recognition.service";

/**
 * Item-type fixtures mirroring the seeded serial rules
 * (see ItemTypesService.seedDefaultItemTypes).
 */
const ITEM_TYPE_ROWS = [
  {
    id: "n950",
    nameAr: "N950",
    nameEn: "N950",
    category: "devices",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "NCC,NCD",
    serialLength: 9,
    serialRegex: "^(NCC|NCD)[0-9]{9}$",
  },
  {
    id: "i9000s",
    nameAr: "I9000S",
    nameEn: "I9000S",
    category: "devices",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "SAS",
    serialLength: 11,
    serialRegex: "^SAS[A-Z0-9]{11}$",
  },
  {
    id: "i9100",
    nameAr: "I9100",
    nameEn: "I9100",
    category: "devices",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "SAW",
    serialLength: 11,
    serialRegex: "^SAW[A-Z0-9]{11}$",
  },
  {
    id: "rollPaper",
    nameAr: "ورق الطباعة",
    nameEn: "rollPaper",
    category: "papers",
    isActive: true,
    requiresSerial: false,
    serialPrefix: null,
    serialLength: null,
    serialRegex: null,
  },
  {
    id: "mobilySim",
    nameAr: "شرائح موبايلي",
    nameEn: "mobilySim",
    category: "sim",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "89966",
    serialLength: 19,
    serialRegex: "^89966[0-9]{14}$",
  },
  {
    id: "stcSim",
    nameAr: "شرائح STC",
    nameEn: "stcSim",
    category: "sim",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "89966",
    serialLength: 18,
    serialRegex: "^89966[0-9]{13}$",
  },
  {
    id: "zainSim",
    nameAr: "شرائح زين",
    nameEn: "zainSim",
    category: "sim",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "89966",
    serialLength: 19,
    serialRegex: "^89966[0-9]{14}$",
  },
  {
    id: "lebaraSim",
    nameAr: "شرائح ليبارا",
    nameEn: "lebaraSim",
    category: "sim",
    isActive: true,
    requiresSerial: true,
    serialPrefix: "89966",
    serialLength: 19,
    serialRegex: "^89966[0-9]{14}$",
  },
];

/**
 * Minimal drizzle-like mock matching the exact chain used in
 * SerialRecognitionService.recognize(): db.select().from(itemTypes).where(...)
 */
const mockTx = {
  select: () => ({
    from: () => ({
      where: async () => ITEM_TYPE_ROWS,
    }),
  }),
} as any;

// 89966 + 14 digits = 19 (Zain / Mobily / Lebara)
const SIM19 = "89966012345678901234".slice(0, 19);
// 89966 + 13 digits = 18 (STC)
const SIM18 = "89966012345678901234".slice(0, 18);

describe("SerialRecognitionService.normalizeRawBarcode", () => {
  it("strips SN: label and separators, uppercases", () => {
    expect(SerialRecognitionService.normalizeRawBarcode("SN:NCD100253066")).toBe("NCD100253066");
    expect(SerialRecognitionService.normalizeRawBarcode("  ncd-100 253_066 ")).toBe("NCD100253066");
    expect(SerialRecognitionService.normalizeRawBarcode("S/N: SAW-ABC.123")).toBe("SAWABC123");
  });

  it("strips grouping spaces from SIM ICCID", () => {
    const spaced = `${SIM19.slice(0, 4)} ${SIM19.slice(4, 8)} ${SIM19.slice(8, 12)} ${SIM19.slice(12, 16)} ${SIM19.slice(16)}`;
    expect(SerialRecognitionService.normalizeRawBarcode(spaced)).toBe(SIM19);
  });

  it("returns empty string for empty/whitespace input", () => {
    expect(SerialRecognitionService.normalizeRawBarcode("")).toBe("");
    expect(SerialRecognitionService.normalizeRawBarcode("   ")).toBe("");
  });
});

describe("SerialRecognitionService.recognize — device type detection", () => {
  it("recognizes N950 and stores the clean 9-digit serial (prefix stripped)", async () => {
    const result = await SerialRecognitionService.recognize("SN:NCD100253066", undefined, mockTx);
    expect(result.itemTypeId).toBe("n950");
    expect(result.normalizedSerial).toBe("100253066");
    expect(result.category).toBe("devices");
    expect(result.carrierName).toBeNull();
  });

  it("recognizes N950 with the NCC prefix variant", async () => {
    const result = await SerialRecognitionService.recognize("NCC123456789", undefined, mockTx);
    expect(result.itemTypeId).toBe("n950");
    expect(result.normalizedSerial).toBe("123456789");
  });

  it("recognizes i9000S (SAS) and strips the prefix", async () => {
    const result = await SerialRecognitionService.recognize("SAS12345678901", undefined, mockTx);
    expect(result.itemTypeId).toBe("i9000s");
    expect(result.normalizedSerial).toBe("12345678901");
  });

  it("recognizes i9100 (SAW) and strips the prefix", async () => {
    const result = await SerialRecognitionService.recognize("SAW1234567890A", undefined, mockTx);
    expect(result.itemTypeId).toBe("i9100");
    expect(result.normalizedSerial).toBe("1234567890A");
  });
});

describe("SerialRecognitionService.recognize — SIM cards", () => {
  it("recognizes an 18-digit ICCID as STC (kept in full, numeric prefix retained)", async () => {
    const result = await SerialRecognitionService.recognize(SIM18, undefined, mockTx);
    expect(result.itemTypeId).toBe("stcSim");
    expect(result.normalizedSerial).toBe(SIM18);
    expect(result.carrierName).toBe("STC");
  });

  it("disambiguates 19-digit SIMs via the item-type hint", async () => {
    const zain = await SerialRecognitionService.recognize(SIM19, "zainSim", mockTx);
    expect(zain.itemTypeId).toBe("zainSim");
    expect(zain.carrierName).toBe("Zain");
    expect(zain.normalizedSerial).toBe(SIM19);

    const lebara = await SerialRecognitionService.recognize(SIM19, "lebaraSim", mockTx);
    expect(lebara.itemTypeId).toBe("lebaraSim");
    expect(lebara.carrierName).toBe("Lebara");
  });
});

describe("SerialRecognitionService.recognize — validation errors", () => {
  it("rejects a serial whose length is wrong for the matched type", async () => {
    await expect(
      SerialRecognitionService.recognize("NCD12345", undefined, mockTx)
    ).rejects.toThrow();
  });

  it("rejects an unrecognized prefix", async () => {
    await expect(
      SerialRecognitionService.recognize("XYZ123456789", undefined, mockTx)
    ).rejects.toThrow();
  });

  it("rejects an empty serial after normalization", async () => {
    await expect(
      SerialRecognitionService.recognize("SN:", undefined, mockTx)
    ).rejects.toThrow();
  });
});

describe("SerialRecognitionService.resolveSerialCandidates", () => {
  it("returns the normalized serial first for a raw labeled device barcode", async () => {
    const candidates = await SerialRecognitionService.resolveSerialCandidates(
      "SN:NCD-100253066",
      undefined,
      mockTx
    );
    expect(candidates[0]).toBe("100253066");
    // Also keeps prefixed forms to match any legacy rows.
    expect(candidates).toContain("NCD100253066");
  });

  it("falls back to the cleaned value when the serial is already normalized", async () => {
    const candidates = await SerialRecognitionService.resolveSerialCandidates(
      "100253066",
      undefined,
      mockTx
    );
    expect(candidates).toContain("100253066");
  });

  it("never returns duplicates", async () => {
    const candidates = await SerialRecognitionService.resolveSerialCandidates(
      SIM18,
      "stcSim",
      mockTx
    );
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});

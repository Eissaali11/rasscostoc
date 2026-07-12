import { db } from "@core/config/db";
import { AppError } from "@core/errors/AppError";
import { itemTypes, items } from "@shared/schema";
import { eq, inArray, or } from "drizzle-orm";

export interface RecognitionResult {
  itemTypeId: string;
  normalizedSerial: string; // The clean serial number to be stored in the DB
  rawBarcode: string;       // The original raw barcode
  isValid: boolean;
  category: string;
  nameAr: string;
  carrierName: string | null;
  error?: string;
}

export interface StoredSerialResolution {
  /** Canonical form that should be written to items.serialNumber */
  normalizedSerial: string;
  itemTypeId: string;
  carrierName: string | null;
  rawBarcode: string;
  category: string;
  nameAr: string;
}

/**
 * Central Serial Engine — normalize → identify → validate → lookup.
 * ALL serial I/O (scan, lookup, verification, closing, return, search) must go through this service.
 * Storage format is unchanged: alphabetic prefixes (NCC/NCD/SAS/SAW) are stripped; numeric SIM prefixes stay.
 */
export class SerialRecognitionService {
  /**
   * Normalize a raw barcode input by removing prefixes like "SN:", spaces, dashes, etc.
   */
  static normalizeRawBarcode(rawBarcode: string): string {
    if (!rawBarcode) return "";
    let cleaned = rawBarcode.trim().toUpperCase();
    // Remove common prefixes like SN:, S/N:, HW:, SERIAL:, BARCODE:
    cleaned = cleaned.replace(/^(SN|S\/N|HW|SERIAL|BARCODE)[:\-\s]*/i, "");
    // GS1 symbology identifiers sometimes prepended by hardware scanners
    cleaned = cleaned.replace(/^\]?(C1|c1)/, "");
    // Remove all whitespace, dashes, underscores, and dots
    cleaned = cleaned.replace(/[\s\-_.]/g, "");
    return cleaned;
  }

  /**
   * Common Saudi ICCID OCR / keypad typo: 99966… → 89966…
   * (ITU-T E.118 country/issuer blocks for KSA SIMs start with 89.)
   */
  static expandSaudiIccidTypoCandidates(cleaned: string): string[] {
    if (!cleaned) return [];
    const out: string[] = [];
    if (/^99966\d{13,14}$/.test(cleaned)) {
      out.push(`89966${cleaned.slice(5)}`);
    }
    return out;
  }

  /**
   * Resolve carrier name based on itemType ID/names
   */
  static resolveCarrierName(itemTypeId: string, nameEn: string, nameAr: string): string | null {
    const idLower = itemTypeId.toLowerCase();
    const nameEnLower = nameEn.toLowerCase();
    const nameArLower = nameAr.toLowerCase();

    if (idLower.includes("stc") || nameEnLower.includes("stc") || nameArLower.includes("stc") || nameArLower.includes("اتصالات")) {
      return "STC";
    }
    if (idLower.includes("mobily") || nameEnLower.includes("mobily") || nameArLower.includes("موبايلي")) {
      return "Mobily";
    }
    if (idLower.includes("zain") || nameEnLower.includes("zain") || nameArLower.includes("زين")) {
      return "Zain";
    }
    if (
      idLower.includes("lebara") ||
      nameEnLower.includes("lebara") ||
      nameEnLower.includes("libar") ||
      nameArLower.includes("ليبارا")
    ) {
      return "Lebara";
    }
    return null;
  }

  /**
   * Build every plausible DB-stored form for a scanned/typed serial.
   * Used by lookup / scan-out / guards so prefixed and stripped forms both resolve.
   */
  static async buildStoredSerialCandidates(
    rawBarcode: string,
    hintItemTypeId?: string,
    txClient: any = db
  ): Promise<string[]> {
    const cleaned = this.normalizeRawBarcode(rawBarcode);
    const candidates = new Set<string>();

    if (!cleaned) return [];

    candidates.add(cleaned);
    const trimmed = rawBarcode.trim();
    if (trimmed) candidates.add(trimmed.toUpperCase());

    for (const typoFix of this.expandSaudiIccidTypoCandidates(cleaned)) {
      candidates.add(typoFix);
    }

    try {
      const recognition = await this.recognize(rawBarcode, hintItemTypeId, txClient);
      candidates.add(recognition.normalizedSerial);
    } catch {
      // Soft path: still strip known alphabetic prefixes even if full validation fails
      // Retry recognize with OCR-corrected ICCID when raw was 99966…
      for (const typoFix of this.expandSaudiIccidTypoCandidates(cleaned)) {
        try {
          const recognition = await this.recognize(typoFix, hintItemTypeId, txClient);
          candidates.add(recognition.normalizedSerial);
        } catch {
          // ignore
        }
      }
    }

    const allTypes = await txClient
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.isActive, true));

    const serializedTypes = allTypes.filter(
      (t: typeof itemTypes.$inferSelect) => t.requiresSerial && t.serialPrefix
    );

    for (const type of serializedTypes) {
      const prefixes = String(type.serialPrefix)
        .split(",")
        .map((p: string) => p.trim().toUpperCase())
        .filter(Boolean);

      for (const prefix of prefixes) {
        const isAlphabetic = /^[A-Z]+$/.test(prefix);
        if (isAlphabetic && cleaned.startsWith(prefix) && cleaned.length > prefix.length) {
          candidates.add(cleaned.substring(prefix.length));
        }
      }
    }

    return [...candidates].filter(Boolean);
  }

  /**
   * Canonical write-path normalizer. Throws if serial cannot be recognized.
   */
  static async normalizeForStorage(
    rawBarcode: string,
    hintItemTypeId?: string,
    txClient: any = db
  ): Promise<StoredSerialResolution> {
    const recognition = await this.recognize(rawBarcode, hintItemTypeId, txClient);
    return {
      normalizedSerial: recognition.normalizedSerial,
      itemTypeId: recognition.itemTypeId,
      carrierName: recognition.carrierName,
      rawBarcode: recognition.rawBarcode,
      category: recognition.category,
      nameAr: recognition.nameAr,
    };
  }

  /**
   * Find an items row by any equivalent serial form (prefixed or stored).
   */
  static async findItemBySerial(
    rawBarcode: string,
    txClient: any = db,
    hintItemTypeId?: string
  ): Promise<typeof items.$inferSelect | null> {
    const candidates = await this.buildStoredSerialCandidates(rawBarcode, hintItemTypeId, txClient);
    if (candidates.length === 0) return null;

    const [item] = await txClient
      .select()
      .from(items)
      .where(
        or(
          inArray(items.serialNumber, candidates),
          inArray(items.barcode, candidates)
        )
      )
      .limit(1);

    return item || null;
  }

  /**
   * Recognize and validate a raw barcode.
   * If a hintItemTypeId is provided, it prioritizes that type for matching/validation.
   */
  static async recognize(rawBarcode: string, hintItemTypeId?: string, txClient: any = db): Promise<RecognitionResult> {
    const cleaned = this.normalizeRawBarcode(rawBarcode);
    if (!cleaned) {
      throw new AppError("الرقم التسلسلي فارغ بعد التنظيف", 400);
    }

    // Fetch all active serialized item types from database
    const allTypes = await txClient
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.isActive, true));

    const serializedTypes = allTypes.filter((t: typeof itemTypes.$inferSelect) => t.requiresSerial);

    const candidates: Array<{ type: typeof itemTypes.$inferSelect; matchedPrefix: string; cleanSerial: string }> = [];

    for (const type of serializedTypes) {
      if (!type.serialPrefix) continue;
      const prefixes = type.serialPrefix.split(",").map((p: string) => p.trim().toUpperCase());
      
      for (const prefix of prefixes) {
        if (cleaned.startsWith(prefix)) {
          // If prefix is alphabetic (starts with letters), strip it. Otherwise (numeric), keep it.
          const isAlphabetic = /^[A-Z]+$/.test(prefix);
          const cleanSerial = isAlphabetic ? cleaned.substring(prefix.length) : cleaned;
          
          candidates.push({
            type,
            matchedPrefix: prefix,
            cleanSerial
          });
        }
      }
    }

    // Fallback: If it did not match any prefix, check if it is already clean (matches length and regex directly)
    for (const type of serializedTypes) {
      if (type.serialLength !== null && type.serialLength !== undefined) {
        if (cleaned.length === type.serialLength) {
          let regexMatches = true;
          if (type.serialRegex) {
            try {
              const regex = new RegExp(type.serialRegex);
              // For stripped serials, also accept when prefixed form would match
              const prefixes = (type.serialPrefix || "")
                .split(",")
                .map((p: string) => p.trim().toUpperCase())
                .filter((p: string) => /^[A-Z]+$/.test(p));
              regexMatches =
                regex.test(cleaned) ||
                prefixes.some((p: string) => regex.test(`${p}${cleaned}`));
            } catch (e) {}
          }
          if (regexMatches) {
            candidates.push({
              type,
              matchedPrefix: "",
              cleanSerial: cleaned
            });
          }
        }
      }
    }

    if (candidates.length === 0) {
      for (const fixed of this.expandSaudiIccidTypoCandidates(cleaned)) {
        return this.recognize(fixed, hintItemTypeId, txClient);
      }
      throw new AppError(`لم يتم التعرف على نوع المنتج للباركود: ${rawBarcode}`, 400);
    }

    // Filter candidates by length
    const validLengthCandidates = candidates.filter(c => {
      if (c.type.serialLength !== null && c.type.serialLength !== undefined) {
        return c.cleanSerial.length === c.type.serialLength;
      }
      return true;
    });

    if (validLengthCandidates.length === 0) {
      // If we matched prefixes but lengths were wrong, show a helpful length error
      const firstCandidate = candidates[0];
      throw new AppError(
        `طول الرقم التسلسلي (${firstCandidate.cleanSerial}) غير صحيح لـ ${firstCandidate.type.nameAr}. الطول المطلوب: ${firstCandidate.type.serialLength} أرقام.`,
        400
      );
    }

    // Select the best candidate:
    // 1. If hintItemTypeId matches one of the valid candidates, use it.
    // 2. Otherwise, use the first valid candidate.
    let selected = validLengthCandidates.find(c => c.type.id === hintItemTypeId);
    if (!selected && hintItemTypeId) {
      // If the hint is a general category hint or partial match, try to match it
      selected = validLengthCandidates.find(c => c.type.id.toLowerCase().includes(hintItemTypeId.toLowerCase()));
    }
    if (!selected) {
      selected = validLengthCandidates[0];
    }

    const { type, cleanSerial } = selected;

    // Validate using regex if defined
    if (type.serialRegex) {
      try {
        const regex = new RegExp(type.serialRegex);
        // Test regex against the clean serial (or raw cleaned if regex expects prefix)
        const prefixes = (type.serialPrefix || "")
          .split(",")
          .map((p: string) => p.trim().toUpperCase())
          .filter((p: string) => /^[A-Z]+$/.test(p));
        const isMatch =
          regex.test(cleanSerial) ||
          regex.test(cleaned) ||
          prefixes.some((p: string) => regex.test(`${p}${cleanSerial}`));
        if (!isMatch) {
          throw new AppError(`الرقم التسلسلي ${rawBarcode} لا يطابق الصيغة المعتمدة لـ ${type.nameAr}`, 400);
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
        // Ignore regex compilation errors
      }
    }

    const carrierName = this.resolveCarrierName(type.id, type.nameEn, type.nameAr);

    return {
      itemTypeId: type.id,
      normalizedSerial: cleanSerial,
      rawBarcode,
      isValid: true,
      category: type.category,
      nameAr: type.nameAr,
      carrierName
    };
  }
}

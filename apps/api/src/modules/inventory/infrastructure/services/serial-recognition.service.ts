import { db } from "@core/config/db";
import { AppError } from "@core/errors/AppError";
import { itemTypes, items } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export class SerialRecognitionService {
  /**
   * Normalize a raw barcode input by removing prefixes like "SN:", spaces, dashes, etc.
   */
  static normalizeRawBarcode(rawBarcode: string): string {
    if (!rawBarcode) return "";
    let cleaned = rawBarcode.trim().toUpperCase();
    // Remove common prefixes like SN:, S/N:, HW:, SERIAL:, BARCODE:
    cleaned = cleaned.replace(/^(SN|S\/N|HW|SERIAL|BARCODE)[:\-\s]*/i, "");
    // Remove all whitespace, dashes, underscores, and dots
    cleaned = cleaned.replace(/[\s\-_.]/g, "");
    return cleaned;
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
    if (idLower.includes("lebara") || nameEnLower.includes("lebara") || nameArLower.includes("ليبارا")) {
      return "Lebara";
    }
    return null;
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

    if (candidates.length === 0) {
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
        const isMatch = regex.test(cleanSerial) || regex.test(cleaned);
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

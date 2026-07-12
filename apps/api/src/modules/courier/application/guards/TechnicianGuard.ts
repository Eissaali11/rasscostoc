/**
 * TechnicianGuard
 *
 * Priority:
 *   1. Resolve technician from items.currentOwnerId when SN is present (authoritative).
 *   2. Fallback: technicianCode / salesTechnician / request.tecName (exact + fuzzy).
 */

import { db } from "@server/core/config/db";
import { users, items } from "@shared/schema";
import { or, eq, inArray, ilike } from "drizzle-orm";
import { GuardValidationError, isCompletedStatus, type GuardContext, type TechUser } from "./guard.types";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";

const ACTIVE_CUSTODY_STATUSES = [
  "IN_TRANSIT_CUSTODY",
  "RECEIVED_BY_TECHNICIAN",
  "IN_TRANSIT",
] as const;

export class TechnicianGuard {
  static async resolve(ctx: GuardContext): Promise<TechUser | null> {
    const { executionData, request } = ctx;

    if (!isCompletedStatus(executionData.installationStatus)) {
      return null;
    }

    const rawSn = executionData.sn?.trim();
    if (rawSn) {
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(rawSn);
      if (candidates.length > 0) {
        const [item] = await db
          .select({ id: items.id, currentOwnerId: items.currentOwnerId, status: items.status })
          .from(items)
          .where(inArray(items.serialNumber, candidates))
          .limit(1);

        if (item?.currentOwnerId) {
          const [techUser] = await db
            .select({ id: users.id, username: users.username, fullName: users.fullName })
            .from(users)
            .where(eq(users.id, item.currentOwnerId))
            .limit(1);

          if (techUser) {
            if (!(ACTIVE_CUSTODY_STATUSES as readonly string[]).includes(item.status)) {
              throw new GuardValidationError(
                `الجهاز (${rawSn}) ليس في حالة عهدة نشطة. الحالة الحالية: ${item.status}`,
                "sn"
              );
            }
            return techUser;
          }
        }
      }
    }

    const technicianCode =
      executionData.technicianCode ||
      executionData.salesTechnician ||
      request.tecName;

    if (!technicianCode || String(technicianCode).trim() === "") {
      throw new GuardValidationError(
        "لم يتم العثور على الفني المسؤول عن الطلب. يرجى إدخال الرقم التسلسلي للجهاز أو تحديد كود الفني.",
        "technicianCode"
      );
    }

    const [techUser] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
      })
      .from(users)
      .where(
        or(
          eq(users.username, technicianCode),
          eq(users.fullName, technicianCode),
          eq(users.technicianCode, technicianCode)
        )
      )
      .limit(1);

    if (techUser) return techUser;

    const labels = TechnicianGuard.normalizeTechLabel(String(technicianCode));
    for (const label of labels) {
      const [fuzzy] = await db
        .select({ id: users.id, username: users.username, fullName: users.fullName })
        .from(users)
        .where(
          or(
            ilike(users.fullName, `%${label}%`),
            ilike(users.username, `%${label}%`),
            ilike(users.technicianCode, `%${label}%`)
          )
        )
        .limit(1);
      if (fuzzy) return fuzzy;
    }

    throw new GuardValidationError(
      `الفني المسؤول "${technicianCode}" غير مسجل في نظام المستخدمين. أنشئ حساب الفني أو اربط الجهاز بعهدته أولاً.`,
      "technicianCode"
    );
  }

  /** "SALAH OMAR_Neoleap" → ["SALAH OMAR", "SALAH", "OMAR"] */
  static normalizeTechLabel(raw: string): string[] {
    const base = String(raw)
      .replace(/_/g, " ")
      .replace(/\b(neoleap|rassco|nl)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!base) return [];
    const tokens = base.split(" ").filter((t) => t.length >= 3);
    return [base, ...tokens];
  }
}

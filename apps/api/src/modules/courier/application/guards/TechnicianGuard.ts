/**
 * TechnicianGuard
 *
 * Validates that the technician associated with the execution
 * is registered in the users table and can be resolved unambiguously.
 *
 * Responsibility: technician identity resolution only.
 */

import { db } from "@server/core/config/db";
import { users } from "@shared/schema";
import { or, eq } from "drizzle-orm";
import { GuardValidationError, isCompletedStatus, type GuardContext, type TechUser } from "./guard.types";

export class TechnicianGuard {
  /**
   * Resolve and validate the technician for a completed execution.
   * Returns the resolved TechUser if validation passes.
   * Throws GuardValidationError if technician cannot be found.
   */
  static async resolve(ctx: GuardContext): Promise<TechUser | null> {
    const { executionData, request } = ctx;

    // Only required for completed statuses
    if (!isCompletedStatus(executionData.installationStatus)) {
      return null;
    }

    const technicianCode =
      executionData.technicianCode ||
      executionData.salesTechnician ||
      request.tecName;

    if (!technicianCode || String(technicianCode).trim() === "") {
      throw new GuardValidationError(
        "لم يتم العثور على الفني المسؤول عن الطلب. يرجى تحديد كود الفني.",
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

    if (!techUser) {
      throw new GuardValidationError(
        `الفني المسؤول "${technicianCode}" غير مسجل في نظام المستخدمين.`,
        "technicianCode"
      );
    }

    return techUser;
  }
}

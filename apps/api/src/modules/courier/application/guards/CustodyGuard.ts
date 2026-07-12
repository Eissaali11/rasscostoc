/**
 * CustodyGuard
 *
 * Validates that every serial number in the execution data is:
 *   1. Currently owned by the resolved technician (currentOwnerId === techUser.id)
 *   2. In the IN_TRANSIT_CUSTODY state
 *
 * Serials are matched via Central Serial Engine (prefixed or stored forms).
 * Responsibility: custody ownership validation only.
 * On failure: logs to audit and throws GuardValidationError (no data written).
 */

import { db } from "@server/core/config/db";
import { items, courierAuditLogs } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { GuardValidationError, isCompletedStatus, type GuardContext, type TechUser } from "./guard.types";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";

export class CustodyGuard {
  /**
   * Validate custody for all serial numbers in the execution.
   * Must be called AFTER TechnicianGuard resolves the techUser.
   *
   * @throws GuardValidationError if any serial is not in active custody
   */
  static async validate(ctx: GuardContext, techUser: TechUser): Promise<void> {
    const { executionData, requestId, enteredBy, existingExecution } = ctx;

    // Only enforced for completed statuses
    if (!isCompletedStatus(executionData.installationStatus)) {
      return;
    }

    // Collect all serials to check
    const serialsToCheck: string[] = [];
    if (executionData.sn?.trim()) serialsToCheck.push(executionData.sn.trim());
    if (executionData.simSerial?.trim()) serialsToCheck.push(executionData.simSerial.trim());
    if (executionData.extraField1?.trim()) serialsToCheck.push(executionData.extraField1.trim());
    if (executionData.extraField2?.trim()) serialsToCheck.push(executionData.extraField2.trim());

    for (const serial of serialsToCheck) {
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serial);

      const [item] = await db
        .select({ id: items.id, serialNumber: items.serialNumber })
        .from(items)
        .where(
          and(
            inArray(items.serialNumber, candidates),
            eq(items.currentOwnerId, techUser.id),
            eq(items.status, "IN_TRANSIT_CUSTODY")
          )
        )
        .limit(1);

      if (!item) {
        await db.insert(courierAuditLogs).values({
          tableName: "executions",
          recordId: requestId,
          fieldName: "status",
          oldValue: existingExecution?.installationStatus ?? null,
          newValue: `فشل التحقق: الرقم التسلسلي ${serial} ليس في عهدة الفني ${techUser.fullName}`,
          action: "verification_failed",
          changedBy: enteredBy,
          changedAt: new Date(),
        });

        throw new GuardValidationError(
          `الرقم التسلسلي "${serial}" ليس ضمن عهدة الفني المسؤول (${techUser.fullName}) حالياً، أو ليس في حالة IN_TRANSIT_CUSTODY.`,
          "sn"
        );
      }
    }
  }
}

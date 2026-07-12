/**
 * CustodyGuard
 *
 * Validates that every serial number in the execution data:
 *   1. Currently owned by the resolved technician (currentOwnerId === techUser.id)
 *   2. Is in an active custody state
 *   3. Device and SIM belong to the SAME technician (no ownership mismatch)
 *   4. Device/SIM linked to the courier request (auto-binds when portal closes without Flutter assign)
 *
 * Serials are matched via Central Serial Engine (prefixed or stored forms).
 */

import { db } from "@server/core/config/db";
import { items, courierAuditLogs, courierRequestItems } from "@shared/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { GuardValidationError, isCompletedStatus, type GuardContext, type TechUser } from "./guard.types";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";

/** Active technician custody — keep in sync with inventory custody semantics (no FSM import). */
const ACTIVE_CUSTODY_STATUSES = [
  "IN_TRANSIT_CUSTODY",
  "RECEIVED_BY_TECHNICIAN",
  "IN_TRANSIT",
] as const;

interface ResolvedSerial {
  raw: string;
  itemId: string;
  serialNumber: string;
  status: string;
  currentOwnerId: string | null;
}

export class CustodyGuard {
  /**
   * Validate custody for all serial numbers in the execution.
   * Must be called AFTER TechnicianGuard resolves the techUser.
   *
   * @throws GuardValidationError if any check fails
   */
  static async validate(ctx: GuardContext, techUser: TechUser): Promise<void> {
    const { executionData, requestId } = ctx;

    if (!isCompletedStatus(executionData.installationStatus)) {
      return;
    }

    const serialEntries: Array<{ raw: string; role: "device" | "sim" | "extra" }> = [];
    if (executionData.sn?.trim()) serialEntries.push({ raw: executionData.sn.trim(), role: "device" });
    if (executionData.simSerial?.trim()) serialEntries.push({ raw: executionData.simSerial.trim(), role: "sim" });
    if (executionData.extraField1?.trim()) serialEntries.push({ raw: executionData.extraField1.trim(), role: "extra" });
    if (executionData.extraField2?.trim()) serialEntries.push({ raw: executionData.extraField2.trim(), role: "extra" });

    const resolved: Array<ResolvedSerial & { role: string }> = [];

    for (const entry of serialEntries) {
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(entry.raw);

      const [item] = await db
        .select({
          id: items.id,
          serialNumber: items.serialNumber,
          status: items.status,
          currentOwnerId: items.currentOwnerId,
        })
        .from(items)
        .where(
          and(
            inArray(items.serialNumber, candidates),
            eq(items.currentOwnerId, techUser.id),
            inArray(items.status, [...ACTIVE_CUSTODY_STATUSES])
          )
        )
        .limit(1);

      if (!item) {
        await CustodyGuard.writeAuditFailure(ctx, techUser, entry.raw);
        throw new GuardValidationError(
          `الرقم التسلسلي "${entry.raw}" ليس ضمن عهدة الفني المسؤول (${techUser.fullName}) حالياً، أو ليس في حالة عهدة نشطة.`,
          entry.role === "sim" ? "simSerial" : "sn"
        );
      }

      resolved.push({
        raw: entry.raw,
        itemId: item.id,
        serialNumber: item.serialNumber,
        status: item.status,
        currentOwnerId: item.currentOwnerId,
        role: entry.role,
      });
    }

    const deviceEntry = resolved.find((r) => r.role === "device");
    const simEntry = resolved.find((r) => r.role === "sim");

    if (deviceEntry && simEntry) {
      if (deviceEntry.currentOwnerId !== simEntry.currentOwnerId) {
        await CustodyGuard.writeAuditFailure(ctx, techUser, `${deviceEntry.raw} / ${simEntry.raw}`);
        throw new GuardValidationError(
          `الجهاز (${deviceEntry.raw}) والشريحة (${simEntry.raw}) تنتميان لفنيين مختلفين. يجب أن يكون المالك واحداً لإغلاق الطلب.`,
          "simSerial"
        );
      }
    }

    // Auto-bind when portal closes without Flutter pre-assigning request items
    if (deviceEntry) {
      const [link] = await db
        .select({ id: courierRequestItems.id })
        .from(courierRequestItems)
        .where(
          and(
            eq(courierRequestItems.requestId, requestId),
            or(
              eq(courierRequestItems.serialNumber, deviceEntry.serialNumber),
              eq(courierRequestItems.simSerial, deviceEntry.serialNumber)
            )
          )
        )
        .limit(1);

      if (!link) {
        await db.insert(courierRequestItems).values({
          requestId,
          itemType: "POS",
          serialNumber: deviceEntry.serialNumber,
          quantity: 1,
          status: "RECEIVED",
          scannedAt: new Date(),
          receivedAt: new Date(),
          technicianId: techUser.id,
        });
      }
    }

    if (simEntry) {
      const [simLink] = await db
        .select({ id: courierRequestItems.id })
        .from(courierRequestItems)
        .where(
          and(
            eq(courierRequestItems.requestId, requestId),
            or(
              eq(courierRequestItems.simSerial, simEntry.serialNumber),
              eq(courierRequestItems.serialNumber, simEntry.serialNumber)
            )
          )
        )
        .limit(1);

      if (!simLink) {
        await db.insert(courierRequestItems).values({
          requestId,
          itemType: "SIM",
          simSerial: simEntry.serialNumber,
          quantity: 1,
          status: "RECEIVED",
          scannedAt: new Date(),
          receivedAt: new Date(),
          technicianId: techUser.id,
        });
      }
    }
  }

  private static async writeAuditFailure(
    ctx: GuardContext,
    techUser: TechUser,
    serial: string
  ): Promise<void> {
    const { requestId, enteredBy, existingExecution } = ctx;
    try {
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
    } catch {
      // Non-critical
    }
  }
}

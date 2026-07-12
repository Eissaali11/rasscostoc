/**
 * CustodyGuard
 *
 * Validates that every serial number in the execution data:
 *   1. Currently owned by the resolved technician (currentOwnerId === techUser.id)
 *   2. Is in an active custody state
 *   3. Device and SIM belong to the SAME technician (no ownership mismatch)
 *   4. Device/SIM linked to the courier request (auto-binds when portal closes without Flutter assign)
 *
 * Supports multiple devices and SIMs via deviceSerials / simSerials.
 * Serials are matched via Central Serial Engine (prefixed or stored forms).
 */

import { db } from "@server/core/config/db";
import { items, courierAuditLogs, courierRequestItems } from "@shared/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  GuardValidationError,
  isCompletedStatus,
  looksLikeInventorySerial,
  normalizeSerialList,
  type GuardContext,
  type TechUser,
} from "./guard.types";
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
  role: "device" | "sim";
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

    const deviceSerials = normalizeSerialList(executionData.deviceSerials, executionData.sn);
    const simSerials = normalizeSerialList(executionData.simSerials, executionData.simSerial);

    // Legacy extra fields only when they look like serials (not Flutter JSON metadata)
    const legacyExtras = [executionData.extraField1, executionData.extraField2]
      .filter((v) => looksLikeInventorySerial(v))
      .map((v) => String(v).trim());

    const serialEntries: Array<{ raw: string; role: "device" | "sim" }> = [
      ...deviceSerials.map((raw) => ({ raw, role: "device" as const })),
      ...simSerials.map((raw) => ({ raw, role: "sim" as const })),
      // Treat leftover extras as devices for custody validation (legacy single-close path)
      ...legacyExtras
        .filter((raw) => !deviceSerials.includes(raw) && !simSerials.includes(raw))
        .map((raw) => ({ raw, role: "device" as const })),
    ];

    const resolved: ResolvedSerial[] = [];

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

    const ownerIds = new Set(
      resolved.map((r) => r.currentOwnerId).filter((id): id is string => !!id)
    );
    if (ownerIds.size > 1) {
      await CustodyGuard.writeAuditFailure(
        ctx,
        techUser,
        resolved.map((r) => r.raw).join(" / ")
      );
      throw new GuardValidationError(
        "الأجهزة والشرائح المدخلة تنتمي لفنيين مختلفين. يجب أن يكون المالك واحداً لإغلاق الطلب.",
        "simSerial"
      );
    }

    // Auto-bind when portal closes without Flutter pre-assigning request items
    for (const entry of resolved.filter((r) => r.role === "device")) {
      const [link] = await db
        .select({ id: courierRequestItems.id })
        .from(courierRequestItems)
        .where(
          and(
            eq(courierRequestItems.requestId, requestId),
            or(
              eq(courierRequestItems.serialNumber, entry.serialNumber),
              eq(courierRequestItems.simSerial, entry.serialNumber)
            )
          )
        )
        .limit(1);

      if (!link) {
        await db.insert(courierRequestItems).values({
          requestId,
          itemType: "POS",
          serialNumber: entry.serialNumber,
          quantity: 1,
          status: "RECEIVED",
          scannedAt: new Date(),
          receivedAt: new Date(),
          technicianId: techUser.id,
        });
      }
    }

    for (const entry of resolved.filter((r) => r.role === "sim")) {
      const [simLink] = await db
        .select({ id: courierRequestItems.id })
        .from(courierRequestItems)
        .where(
          and(
            eq(courierRequestItems.requestId, requestId),
            or(
              eq(courierRequestItems.simSerial, entry.serialNumber),
              eq(courierRequestItems.serialNumber, entry.serialNumber)
            )
          )
        )
        .limit(1);

      if (!simLink) {
        await db.insert(courierRequestItems).values({
          requestId,
          itemType: "SIM",
          simSerial: entry.serialNumber,
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

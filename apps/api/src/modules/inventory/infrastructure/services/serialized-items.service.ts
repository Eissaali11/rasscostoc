import { randomUUID } from "node:crypto";
import { db } from "@core/config/db";
import { AppError, NotFoundError } from "@core/errors/AppError";
import { items, inventoryTransactions, itemHistoryLogs, itemTypes, users, custodyMovements, technicianMovingInventoryEntries, courierRequestItems, systemLogs } from "@shared/schema";
import { eq, and, inArray, sql, or, desc } from "drizzle-orm";
import { SerialRecognitionService } from "./serial-recognition.service";

/** Item is considered "held" by a technician in one of these statuses. */
const TECHNICIAN_HELD_STATUSES = ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN", "IN_TRANSIT"];
/** courier_request_items statuses that mean the request is finished (safe to ignore for the active-relation guard). */
const TERMINAL_COURIER_REQUEST_STATUSES = ["DELIVERED", "REJECTED", "MISSING"];
/** Public itemType URL segment (DEVICE|SIM) → real item_types.category value. No other values are accepted. */
const CUSTODY_DELETE_ITEM_TYPE_TO_CATEGORY: Record<string, string> = {
  DEVICE: "devices",
  SIM: "sim",
};

export class SerializedItemsService {
  private async syncMovingInventory(tx: any, technicianId: string, itemTypeId: string, delta: number) {
    if (!technicianId || !itemTypeId || delta === 0) return;

    const [existingEntry] = await tx
      .select()
      .from(technicianMovingInventoryEntries)
      .where(
        and(
          eq(technicianMovingInventoryEntries.technicianId, technicianId),
          eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
        )
      )
      .limit(1);

    if (existingEntry) {
      const newUnits = Math.max(0, existingEntry.units + delta);
      await tx
        .update(technicianMovingInventoryEntries)
        .set({
          units: newUnits,
          updatedAt: new Date(),
        })
        .where(eq(technicianMovingInventoryEntries.id, existingEntry.id));
    } else if (delta > 0) {
      await tx.insert(technicianMovingInventoryEntries).values({
        technicianId,
        itemTypeId,
        units: delta,
        boxes: 0,
      });
    }
  }

  /**
   * Scan-in (Add Custody)
   */
  async scanIn(
    technicianId: string,
    serialNumber: string,
    itemTypeId: string,
    carrierName?: string,
    simPackageType?: string
  ) {
    return await db.transaction(async (tx: any) => {
      // Central Serial Engine: normalize → identify → validate
      const recognition = await SerialRecognitionService.normalizeForStorage(serialNumber, itemTypeId, tx);
      const cleanSerial = recognition.normalizedSerial;
      const actualItemTypeId = recognition.itemTypeId;
      const actualCarrierName = carrierName || recognition.carrierName;

      // Check if item already exists
      const [existingItem] = await tx
        .select()
        .from(items)
        .where(eq(items.serialNumber, cleanSerial))
        .limit(1);

      if (existingItem) {
        if (existingItem.status === "DELIVERED") {
          throw new AppError("المنتج موجود وحالته مغلق", 400);
        } else {
          throw new AppError("المنتج موجود مسبقاً وحالته نشط", 400);
        }
      }

      // Create new item
      const [newItem] = await tx
        .insert(items)
        .values({
          itemTypeId: actualItemTypeId,
          serialNumber: cleanSerial,
          barcode: cleanSerial, // default barcode to cleanSerial
          status: "IN_TRANSIT_CUSTODY",
          currentOwnerId: technicianId,
          warehouseId: null,
          carrierName: actualCarrierName,
          simPackageType: simPackageType || null,
        })
        .returning();

      if (!newItem) {
        throw new Error("فشل إنشاء سجل للمادة المسلسلة");
      }
      const item = newItem;
      const previousStatus = "NONE";

      // Log transaction
      await tx.insert(inventoryTransactions).values({
        itemId: item.id,
        transactionType: "INTAKE",
        destinationOwnerId: technicianId,
        notes: `تم إضافة العهدة للمندوب بواسطة مسح الباركود`,
      });

      // Log history
      await tx.insert(itemHistoryLogs).values({
        itemId: item.id,
        fromStatus: previousStatus,
        toStatus: "IN_TRANSIT_CUSTODY",
        changedById: technicianId,
        notes: "تم استلام العهدة في سيارة/حقيبة الفني",
      });

      // Log to Custody Ledger (custodyMovements)
      await tx.insert(custodyMovements).values({
        itemId: item.id,
        fromOwnerId: null,
        toOwnerId: technicianId,
        reason: "INTAKE",
        performedById: technicianId,
        notes: "استلام عهدة بالمسح الميداني",
      });

      await this.syncMovingInventory(tx, technicianId, actualItemTypeId, 1);

      return item;
    });
  }

  /**
   * Batch Scan-in (Add Multiple Custodies)
   */
  async batchScanIn(
    technicianId: string,
    scannedItems: Array<{
      serialNumber: string;
      itemTypeId: string;
      carrierName?: string;
      simPackageType?: string;
    }>
  ) {
    // Validate uniqueness of serial numbers in the batch after normalization
    const cleanSerialsList = scannedItems.map(s => SerialRecognitionService.normalizeRawBarcode(s.serialNumber));
    const uniqueSerials = new Set(cleanSerialsList);
    if (uniqueSerials.size !== scannedItems.length) {
      throw new AppError("توجد أرقام تسلسلية مكررة في الدفعة المرسلة بعد التنظيف", 400);
    }

    return await db.transaction(async (tx: any) => {
      const results = [];

      for (const scanned of scannedItems) {
        const { serialNumber, itemTypeId, carrierName, simPackageType } = scanned;

        // التعرف على السيريال والتحقق من صحته
        const recognition = await SerialRecognitionService.recognize(serialNumber, itemTypeId, tx);
        const cleanSerial = recognition.normalizedSerial;
        const actualItemTypeId = recognition.itemTypeId;
        const actualCarrierName = carrierName || recognition.carrierName;

        // Check if item already exists
        const [existingItem] = await tx
          .select()
          .from(items)
          .where(eq(items.serialNumber, cleanSerial))
          .limit(1);

        if (existingItem) {
          if (existingItem.status === "DELIVERED") {
            throw new AppError(`المنتج موجود وحالته مغلق (${cleanSerial})`, 400);
          } else {
            throw new AppError(`المنتج موجود مسبقاً وحالته نشط (${cleanSerial})`, 400);
          }
        }

        // Create new item — status RECEIVED_BY_TECHNICIAN (direct batch receipt)
        const [newItem] = await tx
          .insert(items)
          .values({
            itemTypeId: actualItemTypeId,
            serialNumber: cleanSerial,
            barcode: cleanSerial,
            status: "RECEIVED_BY_TECHNICIAN",
            currentOwnerId: technicianId,
            warehouseId: null,
            carrierName: actualCarrierName,
            simPackageType: simPackageType || null,
          })
          .returning();

        if (!newItem) {
          throw new Error(`فشل إنشاء سجل للمادة المسلسلة: ${cleanSerial}`);
        }
        const item = newItem;
        const previousStatus = "NONE";
        const previousOwnerId = null;

        // Log transaction
        await tx.insert(inventoryTransactions).values({
          itemId: item.id,
          transactionType: "INTAKE",
          destinationOwnerId: technicianId,
          notes: `تم إضافة العهدة للمندوب بواسطة مسح الباركود (دفعة واحدة)`,
        });

        // Log history
        await tx.insert(itemHistoryLogs).values({
          itemId: item.id,
          fromStatus: previousStatus,
          toStatus: "RECEIVED_BY_TECHNICIAN",
          changedById: technicianId,
          notes: "تم استلام العهدة مباشرة من قبل الفني (دفعة واحدة)",
        });

        // Log to Custody Ledger (custodyMovements)
        await tx.insert(custodyMovements).values({
          itemId: item.id,
          fromOwnerId: previousOwnerId,
          toOwnerId: technicianId,
          reason: previousOwnerId ? "TRANSFER" : "INTAKE",
          performedById: technicianId,
          notes: "استلام عهدة بالمسح الميداني (دفعة واحدة)",
        });

        await this.syncMovingInventory(tx, technicianId, actualItemTypeId, 1);

        results.push(item);
      }

      return results;
    });
  }

  /**
   * Scan-out (Deliver Custody / Checkout)
   */
  async scanOut(
    technicianId: string,
    serialNumber: string,
    receiverName: string,
    orderNumber: string,
    latitude?: number,
    longitude?: number
  ) {
    return await db.transaction(async (tx: any) => {
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serialNumber, undefined, tx);
      if (candidates.length === 0) {
        throw new Error("الرقم التسلسلي فارغ بعد التنظيف");
      }

      // Find the item in technician's custody (prefixed or stored form)
      const [item] = await tx
        .select()
        .from(items)
        .where(
          and(
            inArray(items.serialNumber, candidates),
            eq(items.currentOwnerId, technicianId),
            inArray(items.status, ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN"])
          )
        )
        .limit(1);

      if (!item) {
        throw new Error("المادة غير موجودة في عهرتك النشطة أو الرقم التسلسلي غير مطابق");
      }

      // Update item to DELIVERED
      const [updatedItem] = await tx
        .update(items)
        .set({
          status: "DELIVERED",
          currentOwnerId: null, // delivered to customer
          updatedAt: new Date(),
        })
        .where(eq(items.id, item.id))
        .returning();

      if (!updatedItem) {
        throw new Error("فشل إتمام عملية تسليم المادة");
      }

      // Log transaction
      await tx.insert(inventoryTransactions).values({
        itemId: item.id,
        transactionType: "DELIVERY",
        sourceOwnerId: technicianId,
        receiverName,
        orderNumber,
        latitude: latitude || null,
        longitude: longitude || null,
        notes: `تم تسليم العهدة للعميل والتركيب بنجاح`,
      });

      // Log history
      await tx.insert(itemHistoryLogs).values({
        itemId: item.id,
        fromStatus: item.status,
        toStatus: "DELIVERED",
        changedById: technicianId,
        notes: `تم تسليم العهدة وتثبيتها للعميل: ${receiverName}`,
      });

      // Log to Custody Ledger (custodyMovements)
      await tx.insert(custodyMovements).values({
        itemId: item.id,
        fromOwnerId: technicianId,
        toOwnerId: null,
        reason: "DELIVERED",
        referenceType: "COURIER_REQUEST",
        referenceId: orderNumber,
        performedById: technicianId,
        latitude: latitude || null,
        longitude: longitude || null,
        notes: `تسليم العهدة للعميل: ${receiverName}`,
      });

      await this.syncMovingInventory(tx, technicianId, item.itemTypeId, -1);

      return updatedItem;
    });
  }

  /**
   * TEMPORARY FEATURE — remove or disable after final customer handover.
   *
   * Permanently deletes a single serialized item from the *authenticated* technician's
   * own active custody. Ownership is re-derived from `items.currentOwnerId` inside a
   * locked transaction — the caller-supplied technicianId always comes from req.user
   * (JWT/session), never from the request body.
   */
  async deleteFromTechnicianCustody(
    technicianId: string,
    technicianUsername: string,
    technicianRole: string,
    rawItemType: string,
    rawSerialNumber: string,
    confirmation: string,
    reason?: string
  ) {
    const itemType = (rawItemType || "").trim().toUpperCase();
    const expectedCategory = CUSTODY_DELETE_ITEM_TYPE_TO_CATEGORY[itemType];
    if (!expectedCategory) {
      throw new AppError(
        "نوع العنصر يجب أن يكون DEVICE أو SIM فقط",
        400,
        true,
        "INVALID_ITEM_TYPE"
      );
    }

    const trimmedInput = (rawSerialNumber || "").trim();
    const trimmedConfirmation = (confirmation || "").trim();
    const auditReason = (reason || "").trim() || "temporary_cleanup_before_customer_handover";

    if (!trimmedInput) {
      throw new AppError("الرقم التسلسلي مطلوب", 400, true, "INVALID_SERIAL");
    }

    if (!trimmedConfirmation || trimmedConfirmation !== trimmedInput) {
      throw new AppError(
        "رقم التأكيد لا يطابق الرقم التسلسلي المطلوب حذفه",
        400,
        true,
        "CONFIRMATION_MISMATCH"
      );
    }

    return await db.transaction(async (tx: any) => {
      const candidates = await SerialRecognitionService.buildStoredSerialCandidates(
        trimmedInput,
        undefined,
        tx
      );

      if (candidates.length === 0) {
        throw new AppError("الرقم التسلسلي غير صالح", 400, true, "INVALID_SERIAL");
      }

      // Lock the target row for the duration of the transaction to prevent concurrent
      // custody transfer / delivery while we validate and delete it.
      const [item] = await tx
        .select()
        .from(items)
        .where(inArray(items.serialNumber, candidates))
        .for("update");

      if (!item) {
        // Idempotency: a retried request after a prior *successful* delete should not
        // error out — it should clearly report the item as already deleted, without
        // touching inventory again or creating a new audit entry.
        const [priorDeletion] = await tx
          .select({ id: systemLogs.id })
          .from(systemLogs)
          .where(
            and(
              eq(systemLogs.entityType, "item"),
              eq(systemLogs.entityName, trimmedInput),
              eq(systemLogs.action, "delete_custody_serial"),
              eq(systemLogs.userId, technicianId),
              eq(systemLogs.success, true)
            )
          )
          .orderBy(desc(systemLogs.createdAt))
          .limit(1);

        if (priorDeletion) {
          return {
            itemType,
            serialNumber: trimmedInput,
            deleted: true,
            alreadyDeleted: true,
          };
        }

        throw new NotFoundError("العنصر غير موجود في النظام");
      }

      // Custody check: never trust a client-supplied owner id — compare against the
      // row we just locked. Do not reveal who the actual current owner is.
      if (item.currentOwnerId !== technicianId || !TECHNICIAN_HELD_STATUSES.includes(item.status)) {
        throw new AppError(
          "لا يمكنك حذف عنصر غير موجود في عهدتك",
          403,
          true,
          "ITEM_NOT_IN_YOUR_CUSTODY"
        );
      }

      const [itemTypeRow] = await tx
        .select({ nameAr: itemTypes.nameAr, nameEn: itemTypes.nameEn, category: itemTypes.category })
        .from(itemTypes)
        .where(eq(itemTypes.id, item.itemTypeId))
        .limit(1);

      // The URL's itemType (DEVICE/SIM) must match what this serial actually is —
      // never let a mismatched type segment delete (or even confirm the existence of)
      // an item of a different kind.
      if (itemTypeRow?.category !== expectedCategory) {
        throw new NotFoundError(
          itemType === "SIM"
            ? "لا توجد شريحة بهذا الرقم في عهدتك"
            : "لا يوجد جهاز بهذا الرقم في عهدتك"
        );
      }

      // Active-operation guard: an open courier delivery/installation request for this
      // exact serial blocks deletion entirely (no cascade, no partial cleanup).
      const linkedCourierRows = await tx
        .select({ status: courierRequestItems.status })
        .from(courierRequestItems)
        .where(inArray(courierRequestItems.serialNumber, candidates));

      const hasActiveCourierRequest = linkedCourierRows.some(
        (row: any) => !TERMINAL_COURIER_REQUEST_STATUSES.includes(row.status)
      );

      if (hasActiveCourierRequest) {
        throw new AppError(
          "لا يمكن حذف العنصر لارتباطه بعملية نشطة",
          409,
          true,
          "ITEM_HAS_ACTIVE_RELATIONS"
        );
      }

      // Count the historical/ledger rows this item owns before touching anything.
      // These three tables are purely this-item-scoped lifecycle history (not shared
      // financial records) and cascade-delete with the item — the counts below are
      // captured into the permanent system_logs snapshot so nothing is silently lost.
      const [[{ count: transactionsCount }], [{ count: historyCount }], [{ count: custodyCount }]] =
        await Promise.all([
          tx
            .select({ count: sql<number>`count(*)::int` })
            .from(inventoryTransactions)
            .where(eq(inventoryTransactions.itemId, item.id)),
          tx
            .select({ count: sql<number>`count(*)::int` })
            .from(itemHistoryLogs)
            .where(eq(itemHistoryLogs.itemId, item.id)),
          tx
            .select({ count: sql<number>`count(*)::int` })
            .from(custodyMovements)
            .where(eq(custodyMovements.itemId, item.id)),
        ]);

      const correlationId = randomUUID();

      // Durable audit record FIRST. system_logs.entityId/entityName carry no foreign key
      // to items.id, so this row survives the cascade delete of the item's own
      // inventory_transactions / item_history_logs / custody_movements rows below.
      await tx.insert(systemLogs).values({
        userId: technicianId,
        userName: technicianUsername,
        userRole: technicianRole,
        action: "delete_custody_serial",
        entityType: "item",
        entityId: item.id,
        entityName: item.serialNumber,
        details: JSON.stringify({
          correlationId,
          itemType,
          itemId: item.id,
          serialNumber: item.serialNumber,
          itemTypeId: item.itemTypeId,
          itemTypeNameAr: itemTypeRow?.nameAr,
          itemTypeNameEn: itemTypeRow?.nameEn,
          category: itemTypeRow?.category,
          previousStatus: item.status,
          previousOwnerId: item.currentOwnerId,
          warehouseId: item.warehouseId,
          performedById: technicianId,
          reason: auditReason,
          deletedRelationCounts: {
            inventoryTransactions: transactionsCount,
            itemHistoryLogs: historyCount,
            custodyMovements: custodyCount,
            courierRequestItems: linkedCourierRows.length,
          },
          affectedTables: [
            "items",
            "inventory_transactions",
            "item_history_logs",
            "custody_movements",
            "technician_moving_inventory_entries",
          ],
        }),
        description: `تم حذف ${itemType === "SIM" ? "الشريحة" : "الجهاز"} ${item.serialNumber} نهائيًا من عهدة الفني (ميزة مؤقتة قبل التسليم النهائي للعميل) — سجلات تاريخية مرتبطة: ${transactionsCount} حركة، ${historyCount} سجل حالة، ${custodyCount} حركة عهدة`,
        severity: "warn",
        success: true,
      });

      const deletedRows = await tx.delete(items).where(eq(items.id, item.id)).returning();
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("فشل حذف العنصر");
      }

      // Recalculate the technician's moving-inventory balance via the same official
      // path used by scanIn/scanOut — never decrement counters with raw SQL.
      await this.syncMovingInventory(tx, technicianId, item.itemTypeId, -1);

      return {
        itemType,
        serialNumber: item.serialNumber,
        deleted: true,
        alreadyDeleted: false,
      };
    });
  }

  /**
   * Lookup serial number status and history
   * Accepts prefixed (NCD…) or stored (digits) forms via Central Serial Engine.
   */
  async lookup(serialNumber: string) {
    const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serialNumber);

    const [item] = await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        barcode: items.barcode,
        status: items.status,
        carrierName: items.carrierName,
        simPackageType: items.simPackageType,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        itemTypeNameAr: itemTypes.nameAr,
        itemTypeNameEn: itemTypes.nameEn,
        ownerName: users.fullName,
        ownerUsername: users.username,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .leftJoin(users, eq(items.currentOwnerId, users.id))
      .where(
        or(
          inArray(items.serialNumber, candidates),
          inArray(items.barcode, candidates)
        )
      )
      .limit(1);

    if (!item) {
      return null;
    }

    // Get audit trail history
    const history = await db
      .select({
        id: itemHistoryLogs.id,
        fromStatus: itemHistoryLogs.fromStatus,
        toStatus: itemHistoryLogs.toStatus,
        changedAt: itemHistoryLogs.changedAt,
        notes: itemHistoryLogs.notes,
        changedByName: users.fullName,
      })
      .from(itemHistoryLogs)
      .leftJoin(users, eq(itemHistoryLogs.changedById, users.id))
        .where(eq(itemHistoryLogs.itemId, item.id))
        .orderBy(itemHistoryLogs.changedAt);

    return {
      ...item,
      history,
    };
  }

  async getTechnicianCustody(technicianId: string) {
    return await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        status: items.status,
        carrierName: items.carrierName,
        createdAt: items.createdAt,
        itemTypeNameAr: itemTypes.nameAr,
        itemTypeNameEn: itemTypes.nameEn,
        itemTypeId: items.itemTypeId,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .where(
        and(
          eq(items.currentOwnerId, technicianId),
          inArray(items.status, ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN"])
        )
      );
  }

  async updateSerial(id: string, updates: string | { serialNumber?: string; carrierName?: string; simCardType?: string; status?: string }) {
    let patch: any = { updatedAt: new Date() };
    if (typeof updates === "string") {
      const cleanSerial = updates.trim();
      patch.serialNumber = cleanSerial;
      patch.barcode = cleanSerial;
    } else {
      if (updates.serialNumber !== undefined && updates.serialNumber !== null) {
        const cleanSerial = String(updates.serialNumber).trim();
        patch.serialNumber = cleanSerial;
        patch.barcode = cleanSerial;
      }
      if (updates.carrierName !== undefined) {
        patch.carrierName = updates.carrierName ? String(updates.carrierName).trim() : null;
      }
      if (updates.simCardType !== undefined) {
        patch.simPackageType = updates.simCardType ? String(updates.simCardType).trim() : null;
      }
      if (updates.status !== undefined) {
        patch.status = String(updates.status).trim();
      }
    }

    const [updated] = await db
      .update(items)
      .set(patch)
      .where(eq(items.id, id))
      .returning();
    return updated || null;
  }

  async deleteItem(id: string) {
    const [deleted] = await db
      .delete(items)
      .where(eq(items.id, id))
      .returning();
    return !!deleted;
  }
}

export const serializedItemsService = new SerializedItemsService();

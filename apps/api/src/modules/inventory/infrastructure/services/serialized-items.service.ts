import { db } from "@core/config/db";
import { AppError } from "@core/errors/AppError";
import { items, inventoryTransactions, itemHistoryLogs, itemTypes, users, custodyMovements, technicianMovingInventoryEntries } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { SerialRecognitionService } from "./serial-recognition.service";

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

  private async validateSerialFormat(tx: any, serialNumber: string, itemTypeId: string) {
    const [itemType] = await tx
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.id, itemTypeId))
      .limit(1);

    if (!itemType) {
      throw new AppError(`نوع المنتج غير موجود بالرقم: ${itemTypeId}`, 404);
    }

    const serial = serialNumber.trim();

    if (itemType.requiresSerial) {
      // 1. Prefix Validation
      if (itemType.serialPrefix) {
        const prefixes = itemType.serialPrefix.split(',').map((p: string) => p.trim());
        const hasValidPrefix = prefixes.some((prefix: string) => serial.startsWith(prefix));
        if (!hasValidPrefix) {
          throw new AppError(
            `الرقم التسلسلي ${serial} غير صحيح. يجب أن يبدأ بـ: ${prefixes.join(' أو ')}`,
            400
          );
        }
      }

      // 2. Length Validation
      if (itemType.serialLength !== null && itemType.serialLength !== undefined) {
        if (serial.length !== itemType.serialLength) {
          let digitsAfterPrefix = itemType.serialLength;
          if (itemType.serialPrefix) {
            const prefixes = itemType.serialPrefix.split(',').map((p: string) => p.trim());
            const matchedPrefix = prefixes.find((p: string) => serial.startsWith(p));
            if (matchedPrefix) {
              digitsAfterPrefix = itemType.serialLength - matchedPrefix.length;
            }
          }
          throw new AppError(
            `طول الرقم التسلسلي ${serial} غير صحيح. المطلوب: ${digitsAfterPrefix} أرقام بعد البادئة.`,
            400
          );
        }
      }

      // 3. Regex Validation
      if (itemType.serialRegex) {
        const regex = new RegExp(itemType.serialRegex);
        if (!regex.test(serial)) {
          throw new AppError(
            `الرقم التسلسلي ${serial} لا يطابق الصيغة المعتمدة لـ ${itemType.nameAr}.`,
            400
          );
        }
      }
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
      // Find the item in technician's custody
      const [item] = await tx
        .select()
        .from(items)
        .where(
          and(
            eq(items.serialNumber, serialNumber),
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
   * Lookup serial number status and history
   */
  async lookup(serialNumber: string) {
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
      .where(eq(items.serialNumber, serialNumber))
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
}

export const serializedItemsService = new SerializedItemsService();

import { db } from "@core/config/db";
import { AppError } from "@core/errors/AppError";
import { items, inventoryTransactions, itemHistoryLogs, itemTypes, custodyMovements, technicianMovingInventoryEntries } from "@shared/schema";
import { eq, and, inArray, sql, or } from "drizzle-orm";
import { SerialRecognitionService } from "./serial-recognition.service";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

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
   * Lookup serial number status and history
   * Accepts prefixed (NCD…) or stored (digits) forms via Central Serial Engine.
   */
  async lookup(serialNumber: string) {
    const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serialNumber);

    const [itemRow] = await db
      .select({
        id: items.id,
        serialNumber: items.serialNumber,
        barcode: items.barcode,
        status: items.status,
        carrierName: items.carrierName,
        simPackageType: items.simPackageType,
        currentOwnerId: items.currentOwnerId,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        itemTypeNameAr: itemTypes.nameAr,
        itemTypeNameEn: itemTypes.nameEn,
      })
      .from(items)
      .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
      .where(
        or(
          inArray(items.serialNumber, candidates),
          inArray(items.barcode, candidates)
        )
      )
      .limit(1);

    if (!itemRow) {
      return null;
    }

    // Get audit trail history
    const historyRows = await db
      .select({
        id: itemHistoryLogs.id,
        fromStatus: itemHistoryLogs.fromStatus,
        toStatus: itemHistoryLogs.toStatus,
        changedAt: itemHistoryLogs.changedAt,
        notes: itemHistoryLogs.notes,
        changedById: itemHistoryLogs.changedById,
      })
      .from(itemHistoryLogs)
      .where(eq(itemHistoryLogs.itemId, itemRow.id))
      .orderBy(itemHistoryLogs.changedAt);

    const userIds = [
      ...new Set([itemRow.currentOwnerId, ...historyRows.map((h) => h.changedById)].filter(Boolean)),
    ] as string[];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(userIds);

    const item = {
      ...itemRow,
      ownerName: itemRow.currentOwnerId ? usersById.get(itemRow.currentOwnerId)?.fullName : undefined,
      ownerUsername: itemRow.currentOwnerId ? usersById.get(itemRow.currentOwnerId)?.username : undefined,
    };

    const history = historyRows.map((h) => ({
      ...h,
      changedByName: h.changedById ? usersById.get(h.changedById)?.fullName : undefined,
    }));

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

  /** Optional external tx — joins courier Unit-of-Work when provided. */
  private client(tx?: any) {
    return tx || db;
  }

  /**
   * Find serialized item by serial (prefixed or stored). Used by courier via composition adapter.
   */
  async findBySerial(serial: string, tx?: any): Promise<any | null> {
    return SerialRecognitionService.findItemBySerial(serial, this.client(tx));
  }

  /**
   * Transfer existing item into technician custody / in-transit (courier receiving & start-task).
   * Must accept courier UoW `tx` to preserve atomicity with courier request writes.
   */
  async transferCustodyToTechnician(
    params: {
      itemId: string;
      technicianId: string;
      requestId: number;
      oldStatus: string;
      newStatus: "RECEIVED_BY_TECHNICIAN" | "IN_TRANSIT";
    },
    tx?: any
  ): Promise<void> {
    const client = this.client(tx);

    await client
      .update(items)
      .set({
        status: params.newStatus,
        currentOwnerId: params.technicianId,
        updatedAt: new Date(),
      })
      .where(eq(items.id, params.itemId));

    await client.insert(inventoryTransactions).values({
      itemId: params.itemId,
      transactionType: "TRANSFER",
      destinationOwnerId: params.technicianId,
      orderNumber: params.requestId.toString(),
      notes: params.newStatus === "RECEIVED_BY_TECHNICIAN"
        ? `استلام عهدة بالطلب رقم ${params.requestId}`
        : `بدء مهمة التوصيل بالطلب رقم ${params.requestId}`,
    });

    await client.insert(itemHistoryLogs).values({
      itemId: params.itemId,
      fromStatus: params.oldStatus,
      toStatus: params.newStatus,
      changedById: params.technicianId,
      notes: params.newStatus === "RECEIVED_BY_TECHNICIAN"
        ? `تحويل عهدة للفني بالمسح الضوئي - طلب رقم ${params.requestId}`
        : `مغادرة المستودع والبدء بالتوصيل - طلب رقم ${params.requestId}`,
    });
  }

  /**
   * Mint a new serialized item and assign to technician custody (courier scan mint path).
   * Same-db atomic with courier UoW when `tx` is supplied.
   */
  async mintAndAssignToTechnician(
    params: {
      serial: string;
      itemTypeId: string;
      carrierName: string | null;
      technicianId: string;
      requestId: number;
    },
    tx?: any
  ): Promise<{ id: string; serialNumber: string }> {
    const client = this.client(tx);

    const [newItem] = await client
      .insert(items)
      .values({
        itemTypeId: params.itemTypeId,
        serialNumber: params.serial,
        barcode: params.serial,
        status: "RECEIVED_BY_TECHNICIAN",
        currentOwnerId: params.technicianId,
        warehouseId: null,
        carrierName: params.carrierName,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (newItem) {
      await client.insert(inventoryTransactions).values({
        itemId: newItem.id,
        transactionType: "INTAKE",
        destinationOwnerId: params.technicianId,
        orderNumber: params.requestId.toString(),
        notes: `تسجيل أصل جديد بالمسح الضوئي - طلب رقم ${params.requestId}`,
      });

      await client.insert(itemHistoryLogs).values({
        itemId: newItem.id,
        fromStatus: "NONE",
        toStatus: "RECEIVED_BY_TECHNICIAN",
        changedById: params.technicianId,
        notes: `إنشاء أصل جديد عهدة للفني لأول مرة - طلب رقم ${params.requestId}`,
      });
    }

    return {
      id: newItem.id,
      serialNumber: newItem.serialNumber,
    };
  }

  /**
   * Scan-out that returns false when serial is not in active custody (courier InventoryEngine contract).
   */
  async tryScanOut(
    technicianId: string,
    serialNumber: string,
    receiverName: string,
    orderNumber: string,
    latitude?: number,
    longitude?: number
  ): Promise<boolean> {
    try {
      await this.scanOut(technicianId, serialNumber, receiverName, orderNumber, latitude, longitude);
      return true;
    } catch {
      return false;
    }
  }
}

export const serializedItemsService = new SerializedItemsService();

import { db } from "@core/config/db";
import { items, inventoryTransactions, itemHistoryLogs, itemTypes, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class SerializedItemsService {
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
      // Check if item already exists
      const [existingItem] = await tx
        .select()
        .from(items)
        .where(eq(items.serialNumber, serialNumber))
        .limit(1);

      let item: typeof items.$inferSelect;
      let previousStatus = "NONE";

      if (!existingItem) {
        // Create new item
        const [newItem] = await tx
          .insert(items)
          .values({
            itemTypeId,
            serialNumber,
            barcode: serialNumber, // default barcode to serialNumber
            status: "IN_TRANSIT_CUSTODY",
            currentOwnerId: technicianId,
            warehouseId: null,
            carrierName: carrierName || null,
            simPackageType: simPackageType || null,
          })
          .returning();

        if (!newItem) {
          throw new Error("فشل إنشاء سجل للمادة المسلسلة");
        }
        item = newItem;
      } else {
        previousStatus = existingItem.status;
        
        // Update existing item status and owner
        const [updatedItem] = await tx
          .update(items)
          .set({
            status: "IN_TRANSIT_CUSTODY",
            currentOwnerId: technicianId,
            warehouseId: null,
            carrierName: carrierName || existingItem.carrierName,
            simPackageType: simPackageType || existingItem.simPackageType,
            updatedAt: new Date(),
          })
          .where(eq(items.id, existingItem.id))
          .returning();

        if (!updatedItem) {
          throw new Error("فشل تحديث حالة المادة المسلسلة");
        }
        item = updatedItem;
      }

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

      return item;
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
            eq(items.status, "IN_TRANSIT_CUSTODY")
          )
        )
        .limit(1);

      if (!item) {
        throw new Error("المادة غير موجودة في عهدتك النشطة أو الرقم التسلسلي غير مطابق");
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
        fromStatus: "IN_TRANSIT_CUSTODY",
        toStatus: "DELIVERED",
        changedById: technicianId,
        notes: `تم تسليم العهدة وتثبيتها للعميل: ${receiverName}`,
      });

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

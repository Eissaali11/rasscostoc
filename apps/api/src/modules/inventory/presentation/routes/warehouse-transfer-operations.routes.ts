import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryContainer } from "@server/composition/inventory.container";
import { normalizeCreateWarehouseTransferPayload } from "@modules/inventory/application/inventory/use-cases/WarehouseTransferOperations.use-case";
import { db } from "@core/config/db";
import { items, itemTypes, inventoryTransactions, itemHistoryLogs, warehouseTransfers, technicianMovingInventoryEntries } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { DrizzleInventoryUnitOfWork } from "@modules/inventory/infrastructure/database/DrizzleInventoryUnitOfWork";
import { processWarehouseTransferBatch } from "@modules/inventory/application/inventory/use-cases/warehouse-transfer-batch.processor";
import { CustodyEngine } from "../../domain/custody-engine";

/**
 * Warehouse Transfer Operations - العمليات الأساسية للمناقلات (< 100 lines)
 * مجال المسؤولية: إنشاء وعرض وتحديث المناقلات (CRUD Operations)
 */
export function registerWarehouseTransferOperationsRoutes(app: Express): void {

  // عرض جميع المناقلات
  app.get("/api/warehouse-transfers", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const filters = user.role === 'admin' || user.role === 'supervisor'
        ? {}
        : { technicianId: user.id };

      const transfers = await inventoryContainer.getWarehouseTransfersUseCase.execute(filters);
      res.json(transfers);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error fetching warehouse transfers:", message);
      res.status(500).json({ message: "Failed to fetch warehouse transfers" });
    }
  });

  // إنشاء مناقلة جديدة
  app.post("/api/warehouse-transfers", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const normalized = normalizeCreateWarehouseTransferPayload(req.body);

      if (user.role !== 'admin' && user.role !== 'supervisor' && normalized.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك بإنشاء مناقلة لهذا الفني" });
      }

      const result = await inventoryContainer.createWarehouseTransfersUseCase.execute({
        warehouseId: normalized.warehouseId,
        technicianId: normalized.technicianId,
        notes: normalized.notes,
        items: normalized.items,
        performedBy: user.id,
      });

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error creating warehouse transfer:", message);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error instanceof Error && error.message === "No items to transfer") {
        return res.status(400).json({ message: "No items to transfer" });
      }
      res.status(500).json({ message: "Failed to create warehouse transfer" });
    }
  });

  // تحديث حالة المناقلة
  app.patch("/api/warehouse-transfers/:id/status", requireAuth, async (req, res) => {
    try {
      const [transfer] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, req.params.id))
        .limit(1);

      if (!transfer) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'supervisor' && transfer.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك بتحديث حالة هذا الطلب" });
      }

      const status = String(req.body?.status || '').toLowerCase();
      if (status === 'approved' || status === 'accepted') {
        const result = await inventoryContainer.acceptWarehouseTransferUseCase.execute({
          transferId: req.params.id,
        });
        return res.json(result);
      }
      if (status === 'rejected') {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Rejected via status endpoint';
        const result = await inventoryContainer.rejectWarehouseTransferUseCase.execute({
          transferId: req.params.id,
          reason,
        });
        return res.json(result);
      }

      return res.status(400).json({ message: "Invalid status. Use approved|accepted|rejected" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error updating transfer status:", message);
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ message: "Transfer not found" });
      }
      res.status(500).json({ message: "Failed to update transfer status" });
    }
  });

  // قبول مناقلة
  app.post("/api/warehouse-transfers/:id/accept", requireAuth, async (req, res) => {
    try {
      const [transfer] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, req.params.id))
        .limit(1);

      if (!transfer) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'supervisor' && transfer.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك بقبول هذا الطلب" });
      }

      const result = await inventoryContainer.acceptWarehouseTransferUseCase.execute({
        transferId: req.params.id,
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error accepting warehouse transfer:", message);
      res.status(500).json({ message: "Failed to accept transfer" });
    }
  });

  // رفض مناقلة
  app.post("/api/warehouse-transfers/:id/reject", requireAuth, async (req, res) => {
    try {
      const [transfer] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, req.params.id))
        .limit(1);

      if (!transfer) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'supervisor' && transfer.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك برفض هذا الطلب" });
      }

      const { reason } = req.body;
      const result = await inventoryContainer.rejectWarehouseTransferUseCase.execute({
        transferId: req.params.id,
        reason,
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error rejecting warehouse transfer:", message);
      res.status(500).json({ message: "Failed to reject transfer" });
    }
  });

  // ─── v3.0: مسح سيريال مفرد (real-time, فوري) ───
  // الفني يمسح جهازاً أو شريحة واحدة — يُنشأ السيريال في نفس اللحظة
  app.post("/api/warehouse-transfers/:id/scan-serial", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const transferId = req.params.id;
      const { serialNumber } = req.body;

      if (!serialNumber || typeof serialNumber !== 'string' || !serialNumber.trim()) {
        return res.status(400).json({ message: "الرقم التسلسلي مطلوب" });
      }

      const sn = serialNumber.trim();

      // 1. التحقق من وجود الـ Transfer
      const [transfer] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, transferId))
        .limit(1);

      if (!transfer) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      if (user.role !== 'admin' && user.role !== 'supervisor' && transfer.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك بمسح الأرقام التسلسلية لهذا الطلب" });
      }

      if (transfer.status !== 'accepted') {
        return res.status(400).json({ message: "يجب قبول الطلب أولاً قبل بدء المسح" });
      }

      // 2. التحقق من أن الرقم التسلسلي ليس في عهدة فني آخر (active)
      const [existingItem] = await db
        .select()
        .from(items)
        .where(eq(items.serialNumber, sn))
        .limit(1);

      if (existingItem) {
        if (existingItem.status === "DELIVERED") {
          return res.status(400).json({ message: "المنتج موجود وحالته مغلق" });
        } else {
          return res.status(400).json({ message: "المنتج موجود مسبقاً وحالته نشط" });
        }
      }

      // 3. تحديد الـ carrier name للشرائح
      const simCarrierMap: Record<string, string> = {
        mobilySim: 'Mobily',
        stcSim: 'STC',
        zainSim: 'Zain',
        lebara: 'Lebara',
        lebaraSim: 'Lebara',
      };
      const carrierName = simCarrierMap[transfer.itemType] ?? null;

      // 4. إنشاء أو تحديث السيريال (first-scan-creates model)
      // 4. إنشاء السيريال (first-scan-creates model)
      const [newItem] = await db
        .insert(items)
        .values({
          itemTypeId: transfer.itemType,
          serialNumber: sn,
          barcode: sn,
          status: 'RECEIVED_BY_TECHNICIAN',
          currentOwnerId: user.id,
          warehouseId: null,
          carrierName,
        })
        .returning();

      const item = newItem;
      const prevStatus = 'NONE';

      // 5. تسجيل سجل المعاملة والتاريخ
      await db.insert(inventoryTransactions).values({
        itemId: item.id,
        transactionType: 'INTAKE',
        destinationOwnerId: user.id,
        notes: `مسح فردي - استلام العهدة (transfer: ${transferId})`,
      });

      await db.insert(itemHistoryLogs).values({
        itemId: item.id,
        fromStatus: prevStatus,
        toStatus: 'RECEIVED_BY_TECHNICIAN',
        changedById: user.id,
        notes: `تم المسح والاستلام الفردي`,
      });

      return res.status(200).json({
        success: true,
        serialNumber: sn,
        itemId: item.id,
        message: `✓ تم استلام ${sn} بنجاح`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error scanning serial:", message);
      res.status(500).json({ message: message || "فشل مسح الرقم التسلسلي" });
    }
  });

  // ─── v3.0: تأكيد الاستلام النهائي (بعد اكتمال المسح) ───
  // يُحدّث حالة الـ Transfer إلى approved ويضيف الكميات للمخزون المتحرك
  app.post("/api/warehouse-transfers/:id/confirm-receipt", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const transferId = req.params.id;

      // 1. جلب الـ Transfer
      const [transfer] = await db
        .select()
        .from(warehouseTransfers)
        .where(eq(warehouseTransfers.id, transferId))
        .limit(1);

      if (!transfer) {
        return res.status(404).json({ message: "الطلب غير موجود" });
      }

      if (user.role !== 'admin' && user.role !== 'supervisor' && transfer.technicianId !== user.id) {
        return res.status(403).json({ message: "غير مصرح لك بتأكيد استلام هذا الطلب" });
      }

      if (transfer.status !== 'accepted') {
        return res.status(400).json({ message: "الطلب يجب أن يكون مقبولاً ليتم تأكيد استلامه" });
      }

      // 2. للأصناف المسلسلة: التحقق من عدد الـ serials الممسوحة فعلياً
      const serializedCategories = ['n950', 'i9000s', 'i9100', 'mobilySim', 'stcSim', 'zainSim', 'lebara', 'lebaraSim'];
      const isSerialized = serializedCategories.includes(transfer.itemType);

      if (isSerialized) {
        const scannedItems = await db
          .select()
          .from(items)
          .where(
            and(
              eq(items.currentOwnerId, user.id),
              eq(items.status, 'RECEIVED_BY_TECHNICIAN'),
              eq(items.itemTypeId, transfer.itemType),
            )
          );

        // نحسب عدد الـ serials المسجلة لهذا الفني من هذا النوع في آخر 48 ساعة
        const recentlyScanned = scannedItems.filter(item => {
          if (!item.createdAt) return false;
          const diff = Date.now() - new Date(item.createdAt).getTime();
          return diff < 48 * 60 * 60 * 1000;
        });

        if (recentlyScanned.length < transfer.quantity) {
          return res.status(400).json({
            message: `تم مسح ${recentlyScanned.length} فقط من أصل ${transfer.quantity} مطلوبة. أكمل المسح أولاً.`
          });
        }
      }

      // 3. تحديث المخزون المتحرك للفني مباشرة (بدون خصم من المستودع)
      await db.transaction(async (tx) => {
        // تحديث حالة الـ Transfer
        await tx
          .update(warehouseTransfers)
          .set({ status: 'approved', respondedAt: new Date() })
          .where(eq(warehouseTransfers.id, transferId));

        if (!isSerialized) {
          // تحديث أو إنشاء سجل المخزون المتحرك للفني
          const [existingEntry] = await tx
            .select()
            .from(technicianMovingInventoryEntries)
            .where(
              and(
                eq(technicianMovingInventoryEntries.technicianId, user.id),
                eq(technicianMovingInventoryEntries.itemTypeId, transfer.itemType),
              )
            )
            .limit(1);

          const addUnits = transfer.packagingType === 'boxes' ? 0 : transfer.quantity;
          const addBoxes = transfer.packagingType === 'boxes' ? transfer.quantity : 0;

          if (existingEntry) {
            await tx
              .update(technicianMovingInventoryEntries)
              .set({
                units: sql`${technicianMovingInventoryEntries.units} + ${addUnits}`,
                boxes: sql`${technicianMovingInventoryEntries.boxes} + ${addBoxes}`,
                updatedAt: new Date(),
              })
              .where(eq(technicianMovingInventoryEntries.id, existingEntry.id));
          } else {
            await tx.insert(technicianMovingInventoryEntries).values({
              technicianId: user.id,
              itemTypeId: transfer.itemType,
              units: addUnits,
              boxes: addBoxes,
            });
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "تم تأكيد استلام العهدة وتحديث المخزون المتحرك بنجاح",
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error confirming transfer receipt:", message);
      res.status(500).json({ message: message || "فشل تأكيد الاستلام" });
    }
  });

  // ─── v3.0: جلب الأرقام التسلسلية لعهدة الفني ───
  app.get("/api/technicians/:technicianId/serialized-items", requireAuth, async (req, res) => {
    try {
      const { technicianId } = req.params;

      const technicianItems = await db
        .select({
          id: items.id,
          serialNumber: items.serialNumber,
          barcode: items.barcode,
          status: items.status,
          itemTypeId: items.itemTypeId,
          carrierName: items.carrierName,
          createdAt: items.createdAt,
          itemTypeName: itemTypes.nameAr,
          itemTypeCategory: itemTypes.category,
        })
        .from(items)
        .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
        .where(
          and(
            eq(items.currentOwnerId, technicianId),
            eq(items.status, 'RECEIVED_BY_TECHNICIAN'),
          )
        )
        .orderBy(items.createdAt);

      return res.json(technicianItems);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error fetching technician serialized items:", message);
      res.status(500).json({ message: "فشل جلب الأرقام التسلسلية" });
    }
  });

  // ─── v3.0: بحث الأدمن بالسيريال (لصفحة التحقق) ───
  app.get("/api/items/lookup/:serialNumber", requireAuth, async (req, res) => {
    try {
      const { serialNumber } = req.params;

      const [result] = await db
        .select({
          id: items.id,
          serialNumber: items.serialNumber,
          status: items.status,
          itemTypeId: items.itemTypeId,
          carrierName: items.carrierName,
          createdAt: items.createdAt,
          updatedAt: items.updatedAt,
          itemTypeName: itemTypes.nameAr,
          itemTypeCategory: itemTypes.category,
          ownerName: sql<string>`(SELECT full_name FROM users WHERE id = ${items.currentOwnerId})`,
          ownerId: items.currentOwnerId,
        })
        .from(items)
        .leftJoin(itemTypes, eq(items.itemTypeId, itemTypes.id))
        .where(eq(items.serialNumber, serialNumber))
        .limit(1);

      if (!result) {
        return res.status(404).json({ message: `لم يُعثر على سيريال: ${serialNumber}` });
      }

      return res.json(result);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error looking up serial:", message);
      res.status(500).json({ message: "فشل البحث عن الرقم التسلسلي" });
    }
  });

  // ─── v3.2: تحديث حالة السيريال من الأدمن (باستخدام محرك العهدة الموحد) ───
  app.patch("/api/items/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, orderNumber, warehouseId } = req.body;
      const adminId = req.user!.id;

      if (!status) {
        return res.status(400).json({ message: "الحالة مطلوبة" });
      }

      const [existing] = await db
        .select()
        .from(items)
        .where(eq(items.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "العنصر غير موجود" });
      }

      await db.transaction(async (tx) => {
        if (status === "DELIVERED") {
          // معاملة إغلاق المعاملة الذرية
          await CustodyEngine.deliverItem(
            id,
            orderNumber || "CLOSED-BY-ADMIN",
            existing.currentOwnerId || req.user!.id,
            adminId,
            tx
          );
        } else if (status === "RETURNED") {
          // معاملة إرجاع عهدة معتمدة
          await CustodyEngine.returnItem(
            id,
            warehouseId || existing.warehouseId || "primary-warehouse",
            existing.currentOwnerId || req.user!.id,
            adminId,
            tx
          );
        } else {
          // تحديث مباشر للحالات الأخرى
          await tx
            .update(items)
            .set({
              status,
              updatedAt: new Date(),
            })
            .where(eq(items.id, id));

          await tx.insert(itemHistoryLogs).values({
            itemId: id,
            fromStatus: existing.status,
            toStatus: status,
            changedById: adminId,
            notes: `تغيير حالة مباشر بواسطة المشرف`,
          });
        }
      });

      return res.json({ success: true, message: "تم تحديث حالة الرقم التسلسلي بنجاح" });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error updating item status:", message);
      res.status(500).json({ message: error instanceof Error ? error.message : "فشل تحديث حالة الرقم التسلسلي" });
    }
  });
}
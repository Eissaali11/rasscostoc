import { randomUUID } from "crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  itemTypes,
  stockMovements,
  systemLogs,
  technicianMovingInventoryEntries,
  techniciansInventory,
  users,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouses,
} from "@shared/schema";
import { db } from "@core/config/db";

export type ScanSource = "scanner" | "mobile";
export type ScanPackagingType = "box" | "unit";
export type ScanOperationType =
  | "ADD_STOCK"
  | "DEDUCT_STOCK"
  | "TRANSFER_TO_TECHNICIAN"
  | "WITHDRAW_FROM_TECHNICIAN";
export type ScanOwnerType = "warehouse" | "technician";

export type InventoryScanActor = {
  id: string;
  username: string;
  role: string;
  regionId: string | null;
};

export type ExecuteInventoryScanInput = {
  source: ScanSource;
  operationType: ScanOperationType;
  itemCode: string;
  packagingType: ScanPackagingType;
  quantity: number;
  ownerType?: ScanOwnerType;
  ownerId?: string;
  warehouseId?: string;
  technicianId?: string;
  reasonCode?: string;
  idempotencyKey?: string;
  notes?: string;
};

export class InventoryScanError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "InventoryScanError";
  }
}

const LEGACY_FIELD_MAPPING: Record<string, { boxes: string; units: string }> = {
  n950: { boxes: "n950Boxes", units: "n950Units" },
  i9000s: { boxes: "i9000sBoxes", units: "i9000sUnits" },
  i9100: { boxes: "i9100Boxes", units: "i9100Units" },
  rollPaper: { boxes: "rollPaperBoxes", units: "rollPaperUnits" },
  stickers: { boxes: "stickersBoxes", units: "stickersUnits" },
  newBatteries: { boxes: "newBatteriesBoxes", units: "newBatteriesUnits" },
  mobilySim: { boxes: "mobilySimBoxes", units: "mobilySimUnits" },
  stcSim: { boxes: "stcSimBoxes", units: "stcSimUnits" },
  zainSim: { boxes: "zainSimBoxes", units: "zainSimUnits" },
  lebaraSim: { boxes: "lebaraBoxes", units: "lebaraUnits" },
  lebara: { boxes: "lebaraBoxes", units: "lebaraUnits" },
};

export class InventoryScanService {
  async execute(input: ExecuteInventoryScanInput, actor: InventoryScanActor) {
    const normalizedInput = this.normalizeInput(input);
    this.validateInput(normalizedInput);
    this.validateActorPermissions(normalizedInput, actor);

    const itemType = await this.resolveItemTypeByCode(normalizedInput.itemCode);
    if (!itemType) {
      throw new InventoryScanError(404, "لم يتم العثور على نوع المنتج عبر كود المسح");
    }

    const duplicateResult = await this.checkIdempotency(normalizedInput.idempotencyKey);
    if (duplicateResult) {
      return duplicateResult;
    }

    const operationId = randomUUID();

    try {
      const result = await db.transaction(async (tx) => {
        if (normalizedInput.operationType === "ADD_STOCK" || normalizedInput.operationType === "DEDUCT_STOCK") {
          return this.executeSingleOwnerMovement(tx, {
            itemTypeId: itemType.id,
            operationType: normalizedInput.operationType,
            ownerType: normalizedInput.ownerType!,
            ownerId: normalizedInput.ownerId!,
            packagingType: normalizedInput.packagingType,
            quantity: normalizedInput.quantity,
          });
        }

        return this.executeBetweenWarehouseAndTechnician(tx, {
          itemTypeId: itemType.id,
          operationType: normalizedInput.operationType,
          warehouseId: normalizedInput.warehouseId!,
          technicianId: normalizedInput.technicianId!,
          packagingType: normalizedInput.packagingType,
          quantity: normalizedInput.quantity,
        });
      });

      await this.insertStockMovement({
        actor,
        input: normalizedInput,
        itemTypeId: itemType.id,
      });

      await this.logScanEvent({
        actor,
        operationId,
        itemTypeId: itemType.id,
        itemTypeNameAr: itemType.nameAr,
        success: true,
        input: normalizedInput,
        result,
      });

      return {
        success: true,
        duplicate: false,
        operationId,
        itemType: {
          id: itemType.id,
          nameAr: itemType.nameAr,
          nameEn: itemType.nameEn,
        },
        movement: result,
      };
    } catch (error: any) {
      await this.logScanEvent({
        actor,
        operationId,
        itemTypeId: itemType.id,
        itemTypeNameAr: itemType.nameAr,
        success: false,
        input: normalizedInput,
        errorMessage: error?.message || "Unknown error",
      });

      if (error instanceof InventoryScanError) {
        throw error;
      }

      throw new InventoryScanError(500, error?.message || "فشل تنفيذ حركة المسح");
    }
  }

  private normalizeInput(input: ExecuteInventoryScanInput): ExecuteInventoryScanInput {
    return {
      ...input,
      itemCode: String(input.itemCode || "").trim(),
      quantity: Number(input.quantity),
      ownerId: input.ownerId?.trim(),
      warehouseId: input.warehouseId?.trim(),
      technicianId: input.technicianId?.trim(),
      reasonCode: input.reasonCode?.trim(),
      idempotencyKey: input.idempotencyKey?.trim(),
      notes: input.notes?.trim(),
    };
  }

  private validateInput(input: ExecuteInventoryScanInput) {
    if (!input.itemCode) {
      throw new InventoryScanError(400, "كود المنتج مطلوب");
    }

    if (!Number.isFinite(input.quantity) || input.quantity <= 0 || !Number.isInteger(input.quantity)) {
      throw new InventoryScanError(400, "الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر");
    }

    const singleOwnerOps: ScanOperationType[] = ["ADD_STOCK", "DEDUCT_STOCK"];

    if (singleOwnerOps.includes(input.operationType)) {
      if (!input.ownerType || !input.ownerId) {
        throw new InventoryScanError(400, "يجب تحديد جهة الهدف (مستودع أو مندوب) لهذه العملية");
      }
      return;
    }

    if (!input.warehouseId || !input.technicianId) {
      throw new InventoryScanError(400, "يجب تحديد المستودع والمندوب لعمليات التحويل/السحب");
    }
  }

  private validateActorPermissions(input: ExecuteInventoryScanInput, actor: InventoryScanActor) {
    if (actor.role !== "technician") {
      return;
    }

    if (input.operationType === "ADD_STOCK" || input.operationType === "DEDUCT_STOCK") {
      if (input.ownerType !== "technician" || input.ownerId !== actor.id) {
        throw new InventoryScanError(403, "المندوب يمكنه التعديل على مخزونه فقط");
      }
      return;
    }

    if (input.technicianId !== actor.id) {
      throw new InventoryScanError(403, "المندوب يمكنه تنفيذ العمليات على عهدته فقط");
    }
  }

  private async resolveItemTypeByCode(code: string) {
    const [byId] = await db
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.id, code))
      .limit(1);

    if (byId) return byId;

    const [byName] = await db
      .select()
      .from(itemTypes)
      .where(
        or(
          sql`lower(${itemTypes.nameAr}) = lower(${code})`,
          sql`lower(${itemTypes.nameEn}) = lower(${code})`,
        ),
      )
      .limit(1);

    return byName || undefined;
  }

  private async checkIdempotency(idempotencyKey?: string) {
    if (!idempotencyKey) {
      return null;
    }

    const detailsPattern = `%\"idempotencyKey\":\"${idempotencyKey.replace(/%/g, "\\%").replace(/_/g, "\\_")}\"%`;

    const [existing] = await db
      .select({
        id: systemLogs.id,
        description: systemLogs.description,
        createdAt: systemLogs.createdAt,
      })
      .from(systemLogs)
      .where(
        and(
          eq(systemLogs.action, "inventory_scan_execute"),
          sql`${systemLogs.details} LIKE ${detailsPattern}`,
        ),
      )
      .orderBy(desc(systemLogs.createdAt))
      .limit(1);

    if (!existing) {
      return null;
    }

    return {
      success: true,
      duplicate: true,
      message: "تمت معالجة عملية المسح مسبقاً بنفس المفتاح",
      operationLogId: existing.id,
      description: existing.description,
      processedAt: existing.createdAt,
    };
  }

  private async executeSingleOwnerMovement(
    tx: any,
    args: {
      itemTypeId: string;
      operationType: "ADD_STOCK" | "DEDUCT_STOCK";
      ownerType: ScanOwnerType;
      ownerId: string;
      packagingType: ScanPackagingType;
      quantity: number;
    },
  ) {
    const signedQuantity = args.operationType === "ADD_STOCK" ? args.quantity : -args.quantity;

    if (args.ownerType === "warehouse") {
      await this.assertWarehouseExists(args.ownerId);
      const balance = await this.adjustWarehouseBalance(tx, {
        warehouseId: args.ownerId,
        itemTypeId: args.itemTypeId,
        packagingType: args.packagingType,
        delta: signedQuantity,
      });

      return {
        operationType: args.operationType,
        ownerType: args.ownerType,
        ownerId: args.ownerId,
        packagingType: args.packagingType,
        quantity: args.quantity,
        balances: {
          warehouse: balance,
        },
      };
    }

    await this.assertTechnicianExists(args.ownerId);
    const balance = await this.adjustTechnicianMovingBalance(tx, {
      technicianId: args.ownerId,
      itemTypeId: args.itemTypeId,
      packagingType: args.packagingType,
      delta: signedQuantity,
    });

    return {
      operationType: args.operationType,
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      packagingType: args.packagingType,
      quantity: args.quantity,
      balances: {
        technician: balance,
      },
    };
  }

  private async executeBetweenWarehouseAndTechnician(
    tx: any,
    args: {
      itemTypeId: string;
      operationType: "TRANSFER_TO_TECHNICIAN" | "WITHDRAW_FROM_TECHNICIAN";
      warehouseId: string;
      technicianId: string;
      packagingType: ScanPackagingType;
      quantity: number;
    },
  ) {
    await this.assertWarehouseExists(args.warehouseId);
    await this.assertTechnicianExists(args.technicianId);

    const warehouseDelta = args.operationType === "TRANSFER_TO_TECHNICIAN" ? -args.quantity : args.quantity;
    const technicianDelta = -warehouseDelta;

    const warehouseBalance = await this.adjustWarehouseBalance(tx, {
      warehouseId: args.warehouseId,
      itemTypeId: args.itemTypeId,
      packagingType: args.packagingType,
      delta: warehouseDelta,
    });

    const technicianBalance = await this.adjustTechnicianMovingBalance(tx, {
      technicianId: args.technicianId,
      itemTypeId: args.itemTypeId,
      packagingType: args.packagingType,
      delta: technicianDelta,
    });

    return {
      operationType: args.operationType,
      packagingType: args.packagingType,
      quantity: args.quantity,
      warehouseId: args.warehouseId,
      technicianId: args.technicianId,
      balances: {
        warehouse: warehouseBalance,
        technician: technicianBalance,
      },
    };
  }

  private async adjustWarehouseBalance(
    tx: any,
    args: {
      warehouseId: string;
      itemTypeId: string;
      packagingType: ScanPackagingType;
      delta: number;
    },
  ) {
    const [entry] = await tx
      .select()
      .from(warehouseInventoryEntries)
      .where(
        and(
          eq(warehouseInventoryEntries.warehouseId, args.warehouseId),
          eq(warehouseInventoryEntries.itemTypeId, args.itemTypeId),
        ),
      )
      .limit(1);

    const before = args.packagingType === "box" ? Number(entry?.boxes || 0) : Number(entry?.units || 0);
    const after = before + args.delta;

    if (after < 0) {
      throw new InventoryScanError(400, `الرصيد غير كافٍ في المستودع. المتاح: ${before}`);
    }

    const nextBoxes = args.packagingType === "box" ? after : Number(entry?.boxes || 0);
    const nextUnits = args.packagingType === "unit" ? after : Number(entry?.units || 0);

    if (entry) {
      await tx
        .update(warehouseInventoryEntries)
        .set({
          boxes: nextBoxes,
          units: nextUnits,
          updatedAt: new Date(),
        })
        .where(eq(warehouseInventoryEntries.id, entry.id));
    } else {
      await tx.insert(warehouseInventoryEntries).values({
        warehouseId: args.warehouseId,
        itemTypeId: args.itemTypeId,
        boxes: nextBoxes,
        units: nextUnits,
      });
    }

    await this.syncWarehouseLegacyBalance(tx, {
      warehouseId: args.warehouseId,
      itemTypeId: args.itemTypeId,
      packagingType: args.packagingType,
      after,
    });

    return { before, after, delta: args.delta };
  }

  private async adjustTechnicianMovingBalance(
    tx: any,
    args: {
      technicianId: string;
      itemTypeId: string;
      packagingType: ScanPackagingType;
      delta: number;
    },
  ) {
    const [entry] = await tx
      .select()
      .from(technicianMovingInventoryEntries)
      .where(
        and(
          eq(technicianMovingInventoryEntries.technicianId, args.technicianId),
          eq(technicianMovingInventoryEntries.itemTypeId, args.itemTypeId),
        ),
      )
      .limit(1);

    const before = args.packagingType === "box" ? Number(entry?.boxes || 0) : Number(entry?.units || 0);
    const after = before + args.delta;

    if (after < 0) {
      throw new InventoryScanError(400, `الرصيد غير كافٍ في مخزون المندوب. المتاح: ${before}`);
    }

    const nextBoxes = args.packagingType === "box" ? after : Number(entry?.boxes || 0);
    const nextUnits = args.packagingType === "unit" ? after : Number(entry?.units || 0);

    if (entry) {
      await tx
        .update(technicianMovingInventoryEntries)
        .set({
          boxes: nextBoxes,
          units: nextUnits,
          updatedAt: new Date(),
        })
        .where(eq(technicianMovingInventoryEntries.id, entry.id));
    } else {
      await tx.insert(technicianMovingInventoryEntries).values({
        technicianId: args.technicianId,
        itemTypeId: args.itemTypeId,
        boxes: nextBoxes,
        units: nextUnits,
      });
    }

    await this.syncTechnicianLegacyBalance(tx, {
      technicianId: args.technicianId,
      itemTypeId: args.itemTypeId,
      packagingType: args.packagingType,
      after,
    });

    return { before, after, delta: args.delta };
  }

  private async syncWarehouseLegacyBalance(
    tx: any,
    args: {
      warehouseId: string;
      itemTypeId: string;
      packagingType: ScanPackagingType;
      after: number;
    },
  ) {
    const fieldMap = LEGACY_FIELD_MAPPING[args.itemTypeId];
    if (!fieldMap) {
      return;
    }

    const fieldName = args.packagingType === "box" ? fieldMap.boxes : fieldMap.units;

    let [legacyWarehouseInventory] = await tx
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, args.warehouseId))
      .limit(1);

    if (!legacyWarehouseInventory) {
      const [created] = await tx
        .insert(warehouseInventory)
        .values({ warehouseId: args.warehouseId })
        .returning();
      legacyWarehouseInventory = created;
    }

    await tx
      .update(warehouseInventory)
      .set({
        [fieldName]: args.after,
        updatedAt: new Date(),
      })
      .where(eq(warehouseInventory.id, legacyWarehouseInventory.id));
  }

  private async syncTechnicianLegacyBalance(
    tx: any,
    args: {
      technicianId: string;
      itemTypeId: string;
      packagingType: ScanPackagingType;
      after: number;
    },
  ) {
    const fieldMap = LEGACY_FIELD_MAPPING[args.itemTypeId];
    if (!fieldMap) {
      return;
    }

    const fieldName = args.packagingType === "box" ? fieldMap.boxes : fieldMap.units;

    let [legacyInventory] = await tx
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.createdBy, args.technicianId))
      .limit(1);

    if (!legacyInventory) {
      const [techUser] = await tx
        .select({
          fullName: users.fullName,
          city: users.city,
          regionId: users.regionId,
        })
        .from(users)
        .where(eq(users.id, args.technicianId))
        .limit(1);

      const [created] = await tx
        .insert(techniciansInventory)
        .values({
          technicianName: techUser?.fullName || "Unknown Technician",
          city: techUser?.city || "غير محدد",
          createdBy: args.technicianId,
          regionId: techUser?.regionId || null,
        })
        .returning();

      legacyInventory = created;
    }

    await tx
      .update(techniciansInventory)
      .set({
        [fieldName]: args.after,
        updatedAt: new Date(),
      })
      .where(eq(techniciansInventory.id, legacyInventory.id));
  }

  private async insertStockMovement(args: {
    actor: InventoryScanActor;
    input: ExecuteInventoryScanInput;
    itemTypeId: string;
  }) {
    const { actor, input, itemTypeId } = args;

    const technicianIdForRow =
      input.technicianId ||
      (input.ownerType === "technician" ? input.ownerId : undefined) ||
      actor.id;

    const fromInventory = this.resolveFromInventoryLabel(input);
    const toInventory = this.resolveToInventoryLabel(input);

    await db.insert(stockMovements).values({
      technicianId: technicianIdForRow,
      itemType: itemTypeId,
      packagingType: input.packagingType,
      quantity: input.quantity,
      fromInventory,
      toInventory,
      reason: input.reasonCode || "scan_operation",
      performedBy: actor.id,
      notes: input.notes || null,
    });
  }

  private resolveFromInventoryLabel(input: ExecuteInventoryScanInput): string {
    if (input.operationType === "ADD_STOCK") return "external";
    if (input.operationType === "DEDUCT_STOCK") {
      if (input.ownerType === "warehouse") return `warehouse:${input.ownerId}`;
      return `technician:${input.ownerId}:moving`;
    }
    if (input.operationType === "TRANSFER_TO_TECHNICIAN") return `warehouse:${input.warehouseId}`;
    return `technician:${input.technicianId}:moving`;
  }

  private resolveToInventoryLabel(input: ExecuteInventoryScanInput): string {
    if (input.operationType === "DEDUCT_STOCK") return "external";
    if (input.operationType === "ADD_STOCK") {
      if (input.ownerType === "warehouse") return `warehouse:${input.ownerId}`;
      return `technician:${input.ownerId}:moving`;
    }
    if (input.operationType === "TRANSFER_TO_TECHNICIAN") return `technician:${input.technicianId}:moving`;
    return `warehouse:${input.warehouseId}`;
  }

  private async assertWarehouseExists(warehouseId: string) {
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new InventoryScanError(404, "المستودع غير موجود");
    }
  }

  private async assertTechnicianExists(technicianId: string) {
    const [technician] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, technicianId),
          or(eq(users.role, "technician"), eq(users.role, "employee")),
        ),
      )
      .limit(1);

    if (!technician) {
      throw new InventoryScanError(404, "المندوب غير موجود");
    }
  }

  private async logScanEvent(args: {
    actor: InventoryScanActor;
    operationId: string;
    itemTypeId: string;
    itemTypeNameAr: string;
    success: boolean;
    input: ExecuteInventoryScanInput;
    result?: unknown;
    errorMessage?: string;
  }) {
    const { actor, operationId, itemTypeId, itemTypeNameAr, success, input, result, errorMessage } = args;

    try {
      await db.insert(systemLogs).values({
        userId: actor.id,
        userName: actor.username,
        userRole: actor.role,
        regionId: actor.regionId,
        action: "inventory_scan_execute",
        entityType: "inventory_scan",
        entityId: itemTypeId,
        entityName: itemTypeNameAr,
        description: success
          ? `تم تنفيذ حركة مسح ${input.operationType} بنجاح`
          : `فشل تنفيذ حركة مسح ${input.operationType}`,
        details: JSON.stringify({
          operationId,
          source: input.source,
          operationType: input.operationType,
          itemCode: input.itemCode,
          itemTypeId,
          packagingType: input.packagingType,
          quantity: input.quantity,
          ownerType: input.ownerType || null,
          ownerId: input.ownerId || null,
          warehouseId: input.warehouseId || null,
          technicianId: input.technicianId || null,
          reasonCode: input.reasonCode || null,
          idempotencyKey: input.idempotencyKey || null,
          notes: input.notes || null,
          result: result || null,
          errorMessage: errorMessage || null,
        }),
        severity: success ? "info" : "error",
        success,
      });
    } catch (logError) {
      console.error("Failed to write inventory scan log", logError);
    }
  }
}

export const inventoryScanService = new InventoryScanService();


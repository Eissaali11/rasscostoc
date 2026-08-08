import { NotFoundError } from "@core/errors/AppError";
import type {
  IWithdrawTechnicianInventoryToWarehouseUnitOfWork,
} from "@modules/inventory/application/inventory/contracts/IWithdrawTechnicianInventoryToWarehouseUnitOfWork";

export type WithdrawPackagingType = "box" | "unit";

export type WithdrawItemInput = {
  itemTypeId: string;
  packagingType: WithdrawPackagingType;
  quantity: number;
};

export type WithdrawToWarehouseActor = {
  id: string;
  username: string;
  role: string;
  regionId?: string | null;
};

export type WithdrawTechnicianInventoryToWarehouseInput = {
  actor: WithdrawToWarehouseActor;
  technicianId: string;
  warehouseId: string;
  notes?: string;
  items: WithdrawItemInput[];
};

export type WithdrawTechnicianInventoryToWarehouseOutput = {
  success: true;
  message: string;
  itemsCount: number;
  totalQuantity: number;
};

type Warehouse = {
  id: string;
  name: string;
  regionId?: string | null;
};

type TechnicianUser = {
  id: string;
  role: string;
  fullName: string;
  regionId?: string | null;
};

export class WithdrawToWarehouseUseCaseError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "WithdrawToWarehouseUseCaseError";
  }
}

/**
 * Pre-transaction lookups only: user/warehouse existence and region
 * authorization. These are read-only and not part of the balance
 * atomicity requirement -- DB-R1 / Phase C4.6C.2 scope is the inventory
 * mutation race, not these lookups.
 */
export interface IWithdrawTechnicianInventoryToWarehouseLookupRepository {
  getUser(id: string): Promise<TechnicianUser | undefined>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
}

/**
 * Deliberately NOT part of the DB transaction (system_logs is an
 * audit/history sink, not a balance-affecting representation). Atomicity
 * for it is instead guaranteed by call ordering: the use case only
 * invokes this AFTER unitOfWork.execute() has resolved successfully
 * (i.e. after COMMIT). Any thrown error during the transaction rolls
 * back every inventory write and this is never reached, so a
 * failed/rolled-back withdrawal can never leave a success log behind.
 */
export interface IWithdrawSystemLogRepository {
  logSystemActivity(payload: {
    userId: string;
    userName: string;
    userRole: string;
    regionId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    entityName: string;
    description: string;
    details?: string;
    severity: string;
    success: boolean;
  }): Promise<unknown>;
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

export class WithdrawTechnicianInventoryToWarehouseUseCase {
  constructor(
    private readonly lookupRepository: IWithdrawTechnicianInventoryToWarehouseLookupRepository,
    private readonly unitOfWork: IWithdrawTechnicianInventoryToWarehouseUnitOfWork,
    private readonly systemLogRepository: IWithdrawSystemLogRepository
  ) {}

  async execute(
    input: WithdrawTechnicianInventoryToWarehouseInput
  ): Promise<WithdrawTechnicianInventoryToWarehouseOutput> {
    const technician = await this.lookupRepository.getUser(input.technicianId);
    if (!technician || technician.role !== "technician") {
      throw new NotFoundError("Technician not found");
    }

    const warehouse = await this.lookupRepository.getWarehouse(input.warehouseId);
    if (!warehouse) {
      throw new NotFoundError("Warehouse not found");
    }

    if (input.actor.role === "supervisor") {
      if (!input.actor.regionId) {
        throw new WithdrawToWarehouseUseCaseError(400, "المشرف يجب أن يكون مرتبط بمنطقة");
      }
      if (technician.regionId !== input.actor.regionId) {
        throw new WithdrawToWarehouseUseCaseError(403, "لا يمكنك السحب من مندوب خارج منطقتك");
      }
      if (warehouse.regionId !== input.actor.regionId) {
        throw new WithdrawToWarehouseUseCaseError(403, "لا يمكنك السحب إلى مستودع خارج منطقتك");
      }
    }

    const aggregated = new Map<string, WithdrawItemInput>();
    for (const item of input.items) {
      const key = `${item.itemTypeId}:${item.packagingType}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        aggregated.set(key, { ...item });
      }
    }

    // Fixed deterministic lock order (documented, C4.6C.2):
    //   1. warehouses row (per-warehouse anchor -- always exists once
    //      getWarehouse() above succeeded; serializes ALL concurrent
    //      withdrawals into this warehouse, even for an item type whose
    //      warehouse_inventory_entries row doesn't exist yet).
    //   2. technicians_inventory legacy row (per-technician, single row).
    //   3. warehouse_inventory legacy row (per-warehouse, single row).
    //   4. per item type, sorted lexicographically: technician moving
    //      entry, then warehouse moving entry.
    // Every concurrent invocation of this use case acquires locks in
    // exactly this order, so no lock-order inversion / deadlock is
    // possible between two withdrawals.
    const sortedItemTypeIds = Array.from(
      new Set(Array.from(aggregated.values()).map((item) => item.itemTypeId))
    ).sort();

    const totalQuantity = await this.unitOfWork.execute(async (ctx) => {
      await ctx.warehouseLock.lockWarehouse(input.warehouseId);

      const legacyTechnicianInventory = await ctx.legacyTechnicianInventory.lockLegacyInventory(input.technicianId);
      const legacyWarehouseInventory = await ctx.legacyWarehouseInventory.lockLegacyInventory(input.warehouseId);

      const lockedTechnicianEntries = new Map<string, { boxes: number; units: number }>();
      const lockedWarehouseEntries = new Map<string, { boxes: number; units: number }>();

      for (const itemTypeId of sortedItemTypeIds) {
        lockedTechnicianEntries.set(
          itemTypeId,
          await ctx.technicianMovingInventory.lockOrCreateEntry(input.technicianId, itemTypeId)
        );
        lockedWarehouseEntries.set(
          itemTypeId,
          await ctx.warehouseMovingInventory.lockOrCreateEntry(input.warehouseId, itemTypeId)
        );
      }

      // Re-check availability against the LOCKED (post-lock, current
      // committed) balances -- not the pre-lock reads -- closing the
      // race confirmed live in Phase C4.6C.1.
      const technicianLegacyUpdates: Record<string, number> = {};
      const warehouseLegacyUpdates: Record<string, number> = {};

      for (const item of Array.from(aggregated.values())) {
        const { itemTypeId, packagingType, quantity } = item;
        const legacyFields = LEGACY_FIELD_MAPPING[itemTypeId];

        const technicianEntry = lockedTechnicianEntries.get(itemTypeId)!;
        const warehouseEntry = lockedWarehouseEntries.get(itemTypeId)!;

        if (packagingType === "box") {
          if (technicianEntry.boxes < quantity) {
            throw new WithdrawToWarehouseUseCaseError(
              400,
              `الكمية غير كافية للصنف ${itemTypeId}. المتاح: ${technicianEntry.boxes} كرتون`
            );
          }
          technicianEntry.boxes -= quantity;
          warehouseEntry.boxes += quantity;
        } else {
          if (technicianEntry.units < quantity) {
            throw new WithdrawToWarehouseUseCaseError(
              400,
              `الكمية غير كافية للصنف ${itemTypeId}. المتاح: ${technicianEntry.units} وحدة`
            );
          }
          technicianEntry.units -= quantity;
          warehouseEntry.units += quantity;
        }

        if (legacyFields && legacyTechnicianInventory && legacyWarehouseInventory) {
          if (packagingType === "box") {
            const currentTechLegacy = Number(legacyTechnicianInventory[legacyFields.boxes] || 0);
            const currentWarehouseLegacy = Number(legacyWarehouseInventory[legacyFields.boxes] || 0);
            technicianLegacyUpdates[legacyFields.boxes] = Math.max(0, currentTechLegacy - quantity);
            warehouseLegacyUpdates[legacyFields.boxes] = currentWarehouseLegacy + quantity;
          } else {
            const currentTechLegacy = Number(legacyTechnicianInventory[legacyFields.units] || 0);
            const currentWarehouseLegacy = Number(legacyWarehouseInventory[legacyFields.units] || 0);
            technicianLegacyUpdates[legacyFields.units] = Math.max(0, currentTechLegacy - quantity);
            warehouseLegacyUpdates[legacyFields.units] = currentWarehouseLegacy + quantity;
          }
        }
      }

      for (const itemTypeId of sortedItemTypeIds) {
        const technicianEntry = lockedTechnicianEntries.get(itemTypeId)!;
        const warehouseEntry = lockedWarehouseEntries.get(itemTypeId)!;

        await ctx.technicianMovingInventory.setEntry(
          input.technicianId,
          itemTypeId,
          technicianEntry.boxes,
          technicianEntry.units
        );
        await ctx.warehouseMovingInventory.setEntry(
          input.warehouseId,
          itemTypeId,
          warehouseEntry.boxes,
          warehouseEntry.units
        );
      }

      if (legacyTechnicianInventory && Object.keys(technicianLegacyUpdates).length > 0) {
        await ctx.legacyTechnicianInventory.updateLegacyInventory(input.technicianId, technicianLegacyUpdates);
      }
      if (legacyWarehouseInventory && Object.keys(warehouseLegacyUpdates).length > 0) {
        await ctx.legacyWarehouseInventory.updateLegacyInventory(input.warehouseId, warehouseLegacyUpdates);
      }

      return Array.from(aggregated.values()).reduce((sum, item) => sum + item.quantity, 0);
    });

    // system_logs is written only AFTER the transaction above has
    // successfully committed -- a thrown error (insufficient balance,
    // any internal failure) rolls back every inventory write above and
    // never reaches this call, so no success log can survive a
    // failed/rolled-back withdrawal (C4.6C.2 system_logs atomicity
    // requirement, satisfied without adding system_logs to the DB
    // transaction itself).
    await this.systemLogRepository.logSystemActivity({
      userId: input.actor.id,
      userName: input.actor.username,
      userRole: input.actor.role,
      regionId: input.actor.regionId || null,
      action: "transfer",
      entityType: "warehouse",
      entityId: input.warehouseId,
      entityName: warehouse.name,
      description: `تم سحب ${totalQuantity} من مخزون المندوب ${technician.fullName} إلى المستودع ${warehouse.name}`,
      details: JSON.stringify({
        technicianId: input.technicianId,
        technicianName: technician.fullName,
        warehouseId: input.warehouseId,
        warehouseName: warehouse.name,
        items: Array.from(aggregated.values()),
        notes: input.notes || null,
      }),
      severity: "info",
      success: true,
    });

    return {
      success: true,
      message: "تم سحب المخزون إلى المستودع بنجاح",
      itemsCount: aggregated.size,
      totalQuantity,
    };
  }
}

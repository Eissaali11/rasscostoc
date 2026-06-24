import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  technicianMovingInventoryEntries,
  warehouses,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouseTransfers,
} from "@shared/schema";
import type {
  WarehouseTransferBatchCriteria,
  TechnicianMovingStockBalance,
  WarehouseStockBalance,
  WarehouseTransferRecord,
} from "@modules/inventory/application/inventory/contracts/IWarehouseTransferBatchRepository";
import type { WarehouseTransfer } from '@shared/schema';

type LegacyFieldMap = {
  boxes: string;
  units: string;
};

const legacyWarehouseFieldMap: Record<string, LegacyFieldMap> = {
  n950: { boxes: 'n950Boxes', units: 'n950Units' },
  i9000s: { boxes: 'i9000sBoxes', units: 'i9000sUnits' },
  i9100: { boxes: 'i9100Boxes', units: 'i9100Units' },
  rollPaper: { boxes: 'rollPaperBoxes', units: 'rollPaperUnits' },
  stickers: { boxes: 'stickersBoxes', units: 'stickersUnits' },
  newBatteries: { boxes: 'newBatteriesBoxes', units: 'newBatteriesUnits' },
  mobilySim: { boxes: 'mobilySimBoxes', units: 'mobilySimUnits' },
  stcSim: { boxes: 'stcSimBoxes', units: 'stcSimUnits' },
  zainSim: { boxes: 'zainSimBoxes', units: 'zainSimUnits' },
  lebara: { boxes: 'lebaraBoxes', units: 'lebaraUnits' },
  lebaraSim: { boxes: 'lebaraBoxes', units: 'lebaraUnits' },
};

export class DrizzleWarehouseTransferBatchRepository {
  constructor(private readonly executor: any) {}

  async findPendingTransferIdsByCriteria(criteria?: WarehouseTransferBatchCriteria): Promise<string[]> {
    const conditions: any[] = [eq(warehouseTransfers.status, 'pending')];

    if (criteria?.warehouseId) {
      conditions.push(eq(warehouseTransfers.warehouseId, criteria.warehouseId));
    }

    if (criteria?.technicianId) {
      conditions.push(eq(warehouseTransfers.technicianId, criteria.technicianId));
    }

    if (criteria?.regionId) {
      conditions.push(eq(warehouses.regionId, criteria.regionId));
    }

    let query = this.executor
      .select({ id: warehouseTransfers.id })
      .from(warehouseTransfers)
      .leftJoin(warehouses, eq(warehouseTransfers.warehouseId, warehouses.id))
      .where(and(...conditions))
      .orderBy(desc(warehouseTransfers.createdAt));

    if (criteria?.limit && criteria.limit > 0) {
      query = query.limit(criteria.limit);
    }

    const rows = await query;
    return rows.map((row: { id: string }) => row.id);
  }

  private typeTransferRow(row: {
    id: string;
    warehouseId: string;
    technicianId: string;
    itemType: string;
    packagingType: string;
    quantity: number;
    status: string;
    performedBy: string;
    notes?: string | null;
  }): WarehouseTransferRecord {
    return {
      ...row,
      packagingType: row.packagingType as 'box' | 'unit',
    };
  }

  async getTransfersByIds(transferIds: string[]): Promise<WarehouseTransferRecord[]> {
    if (transferIds.length === 0) {
      return [];
    }

    const transfers = await this.executor
      .select({
        id: warehouseTransfers.id,
        warehouseId: warehouseTransfers.warehouseId,
        technicianId: warehouseTransfers.technicianId,
        itemType: warehouseTransfers.itemType,
        packagingType: warehouseTransfers.packagingType,
        quantity: warehouseTransfers.quantity,
        status: warehouseTransfers.status,
        performedBy: warehouseTransfers.performedBy,
        notes: warehouseTransfers.notes,
      })
      .from(warehouseTransfers)
      .where(inArray(warehouseTransfers.id, transferIds));

    return transfers.map((transfer: {
      id: string;
      warehouseId: string;
      technicianId: string;
      itemType: string;
      packagingType: string;
      quantity: number;
      status: string;
      performedBy: string;
      notes?: string | null;
    }) => this.typeTransferRow(transfer));
  }

  async findLatestTransferIdByRequestId(requestId: string): Promise<string | undefined> {
    const [row] = await this.executor
      .select({ id: warehouseTransfers.id })
      .from(warehouseTransfers)
      .where(eq(warehouseTransfers.requestId, requestId))
      .orderBy(desc(warehouseTransfers.createdAt))
      .limit(1);

    return row?.id;
  }

  async getWarehouseBalance(warehouseId: string, itemTypeId: string): Promise<WarehouseStockBalance> {
    const [entry] = await this.executor
      .select({
        boxes: warehouseInventoryEntries.boxes,
        units: warehouseInventoryEntries.units,
      })
      .from(warehouseInventoryEntries)
      .where(
        and(
          eq(warehouseInventoryEntries.warehouseId, warehouseId),
          eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
        )
      );

    if (entry) {
      return {
        boxes: entry.boxes,
        units: entry.units,
        source: 'entries',
      };
    }

    const [legacyInventory] = await this.executor
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId));

    if (!legacyInventory) {
      throw new Error(`Warehouse inventory not found for warehouse ${warehouseId}`);
    }

    const legacyFields = legacyWarehouseFieldMap[itemTypeId];
    if (!legacyFields) {
      // New item type not in legacy system - return zero balance
      return {
        boxes: 0,
        units: 0,
        source: 'entries',
      };
    }

    return {
      boxes: Number((legacyInventory as any)[legacyFields.boxes] || 0),
      units: Number((legacyInventory as any)[legacyFields.units] || 0),
      source: 'legacy',
    };
  }

  async setWarehouseBalance(warehouseId: string, itemTypeId: string, balance: WarehouseStockBalance): Promise<void> {
    if (balance.source === 'entries') {
      const [existing] = await this.executor
        .select({ id: warehouseInventoryEntries.id })
        .from(warehouseInventoryEntries)
        .where(
          and(
            eq(warehouseInventoryEntries.warehouseId, warehouseId),
            eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
          )
        );

      if (existing) {
        await this.executor
          .update(warehouseInventoryEntries)
          .set({
            boxes: balance.boxes,
            units: balance.units,
            updatedAt: new Date(),
          })
          .where(eq(warehouseInventoryEntries.id, existing.id));
        return;
      }

      await this.executor.insert(warehouseInventoryEntries).values({
        warehouseId,
        itemTypeId,
        boxes: balance.boxes,
        units: balance.units,
      });
      return;
    }

    const legacyFields = legacyWarehouseFieldMap[itemTypeId];
    if (!legacyFields) {
      // New item type - store in entries table instead
      await this.executor.insert(warehouseInventoryEntries).values({
        warehouseId,
        itemTypeId,
        boxes: balance.boxes,
        units: balance.units,
      });
      return;
    }

    await this.executor
      .update(warehouseInventory)
      .set({
        [legacyFields.boxes]: balance.boxes,
        [legacyFields.units]: balance.units,
        updatedAt: new Date(),
      })
      .where(eq(warehouseInventory.warehouseId, warehouseId));
  }

  async getTechnicianMovingBalance(
    technicianId: string,
    itemTypeId: string
  ): Promise<TechnicianMovingStockBalance> {
    const [entry] = await this.executor
      .select({
        boxes: technicianMovingInventoryEntries.boxes,
        units: technicianMovingInventoryEntries.units,
      })
      .from(technicianMovingInventoryEntries)
      .where(
        and(
          eq(technicianMovingInventoryEntries.technicianId, technicianId),
          eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
        )
      );

    return {
      boxes: entry?.boxes ?? 0,
      units: entry?.units ?? 0,
    };
  }

  async setTechnicianMovingBalance(
    technicianId: string,
    itemTypeId: string,
    balance: TechnicianMovingStockBalance
  ): Promise<void> {
    const [existing] = await this.executor
      .select({ id: technicianMovingInventoryEntries.id })
      .from(technicianMovingInventoryEntries)
      .where(
        and(
          eq(technicianMovingInventoryEntries.technicianId, technicianId),
          eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
        )
      );

    if (existing) {
      await this.executor
        .update(technicianMovingInventoryEntries)
        .set({
          boxes: balance.boxes,
          units: balance.units,
          updatedAt: new Date(),
        })
        .where(eq(technicianMovingInventoryEntries.id, existing.id));
      return;
    }

    await this.executor.insert(technicianMovingInventoryEntries).values({
      technicianId,
      itemTypeId,
      boxes: balance.boxes,
      units: balance.units,
    });
  }

  async markTransfersApproved(transferIds: string[]): Promise<WarehouseTransfer[]> {
    if (transferIds.length === 0) {
      return [];
    }

    return this.executor
      .update(warehouseTransfers)
      .set({
        status: 'accepted',
        respondedAt: new Date(),
      })
      .where(and(inArray(warehouseTransfers.id, transferIds), eq(warehouseTransfers.status, 'pending')))
      .returning();
  }

  async markTransfersRejected(transferIds: string[], reason: string): Promise<WarehouseTransfer[]> {
    if (transferIds.length === 0) {
      return [];
    }

    return this.executor
      .update(warehouseTransfers)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        respondedAt: new Date(),
      })
      .where(and(inArray(warehouseTransfers.id, transferIds), eq(warehouseTransfers.status, 'pending')))
      .returning();
  }
}

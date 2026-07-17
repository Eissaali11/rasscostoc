import { eq, desc, and, sql } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  warehouseTransfers,
  warehouses,
  WarehouseTransferWithDetails
} from "@shared/schema";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

export interface ITransferQueryRepository {
  getWarehouseTransfers(
    warehouseId?: string,
    technicianId?: string,
    regionId?: string,
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]>;
}

/**
 * Transfer Query Repository Implementation
 * Handles all transfer-related read operations
 */
export class TransferQueryRepository implements ITransferQueryRepository {
  private get db() {
    return getDatabase();
  }

  async getWarehouseTransfers(
    warehouseId?: string, 
    technicianId?: string, 
    regionId?: string, 
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]> {
    // Item name mapping for Arabic display
    const itemNameMap: Record<string, string> = {
      'n950': 'N950',
      'i9000s': 'I9000s',
      'i9100': 'I9100',
      'rollPaper': 'ورق حراري',
      'stickers': 'ملصقات',
      'newBatteries': 'بطاريات جديدة',
      'mobilySim': 'شريحة موبايلي',
      'stcSim': 'شريحة STC',
      'zainSim': 'شريحة زين',
      'lebara': 'شريحة ليبارا',
      'lebaraSim': 'شريحة ليبارا',
    };

    let query = this.db
      .select({
        id: warehouseTransfers.id,
        requestId: warehouseTransfers.requestId,
        warehouseId: warehouseTransfers.warehouseId,
        technicianId: warehouseTransfers.technicianId,
        itemType: warehouseTransfers.itemType,
        packagingType: warehouseTransfers.packagingType,
        quantity: warehouseTransfers.quantity,
        performedBy: warehouseTransfers.performedBy,
        notes: warehouseTransfers.notes,
        status: warehouseTransfers.status,
        transferType: warehouseTransfers.transferType,
        rejectionReason: warehouseTransfers.rejectionReason,
        respondedAt: warehouseTransfers.respondedAt,
        createdAt: warehouseTransfers.createdAt,
        warehouseName: warehouses.name,
      })
      .from(warehouseTransfers)
      .leftJoin(warehouses, eq(warehouseTransfers.warehouseId, warehouses.id))
      .orderBy(desc(warehouseTransfers.createdAt));

    const conditions = [];
    if (warehouseId) {
      conditions.push(eq(warehouseTransfers.warehouseId, warehouseId));
    }
    if (technicianId) {
      conditions.push(eq(warehouseTransfers.technicianId, technicianId));
    }
    if (regionId) {
      conditions.push(eq(warehouses.regionId, regionId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (limit) {
      query = query.limit(limit) as any;
    }

    const transfers = await query;

    const userIds = new Set<string>();
    for (const t of transfers) {
      if (t.technicianId) userIds.add(t.technicianId);
      if (t.performedBy) userIds.add(t.performedBy);
    }
    const usersById = await getInventoryIdentityPorts().getUsersByIds([...userIds]);

    return transfers.map(transfer => ({
      ...transfer,
      status: transfer.status === 'approved' ? 'accepted' : transfer.status,
      itemNameAr: itemNameMap[transfer.itemType] || transfer.itemType,
      warehouseName: transfer.warehouseName || undefined,
      technicianName: (transfer.technicianId && usersById.get(transfer.technicianId)?.fullName) || undefined,
      performedByName: (transfer.performedBy && usersById.get(transfer.performedBy)?.fullName) || undefined,
    }));
  }
}
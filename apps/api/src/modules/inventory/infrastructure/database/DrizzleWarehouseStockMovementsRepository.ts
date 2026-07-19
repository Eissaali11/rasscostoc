import { desc, eq, inArray } from 'drizzle-orm';
import { stockMovements, supervisorWarehouses, warehouseInventory } from "@shared/schema";
import type { IWarehouseStockMovementsRepository } from "@modules/inventory/application/inventory/contracts/IWarehouseStockMovementsRepository";
import type { StockMovementWithDetails, WarehouseInventory } from '@shared/schema';
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

const stockMovementColumns = {
  id: stockMovements.id,
  technicianId: stockMovements.technicianId,
  itemType: stockMovements.itemType,
  packagingType: stockMovements.packagingType,
  quantity: stockMovements.quantity,
  fromInventory: stockMovements.fromInventory,
  toInventory: stockMovements.toInventory,
  reason: stockMovements.reason,
  performedBy: stockMovements.performedBy,
  notes: stockMovements.notes,
  createdAt: stockMovements.createdAt,
};

export class DrizzleWarehouseStockMovementsRepository implements IWarehouseStockMovementsRepository {
  constructor(private readonly executor: any) {}

  private async withTechnicianNames(rows: any[]): Promise<StockMovementWithDetails[]> {
    const technicianIds = [...new Set(rows.map((r) => r.technicianId).filter(Boolean))];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(technicianIds);
    return rows.map((row) => ({
      ...row,
      technicianName: usersById.get(row.technicianId)?.fullName || undefined,
      performedByName: undefined,
      itemNameAr: row.itemType,
    }));
  }

  async getStockMovements(limit: number = 50): Promise<StockMovementWithDetails[]> {
    const rows = await this.executor
      .select(stockMovementColumns)
      .from(stockMovements)
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return this.withTechnicianNames(rows);
  }

  async getStockMovementsByRegion(regionId: string | null): Promise<StockMovementWithDetails[]> {
    if (!regionId) {
      return [];
    }

    const technicianIdsInRegion = await getInventoryIdentityPorts().getUserIdsByRegion(regionId);
    if (technicianIdsInRegion.length === 0) return [];

    const rows = await this.executor
      .select(stockMovementColumns)
      .from(stockMovements)
      .where(inArray(stockMovements.technicianId, technicianIdsInRegion as string[]))
      .orderBy(desc(stockMovements.createdAt));

    return this.withTechnicianNames(rows);
  }

  async getStockMovementsByTechnician(technicianId: string, limit: number = 50): Promise<StockMovementWithDetails[]> {
    const rows = await this.executor
      .select(stockMovementColumns)
      .from(stockMovements)
      .where(eq(stockMovements.technicianId, technicianId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return this.withTechnicianNames(rows);
  }

  async getSupervisorWarehouseIds(supervisorId: string): Promise<string[]> {
    const rows = await this.executor
      .select({ warehouseId: supervisorWarehouses.warehouseId })
      .from(supervisorWarehouses)
      .where(eq(supervisorWarehouses.supervisorId, supervisorId));

    return rows.map((row: any) => row.warehouseId);
  }

  async getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<WarehouseInventory[]> {
    return this.executor
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId));
  }
}
import { desc, eq } from 'drizzle-orm';
import { stockMovements, supervisorWarehouses, users, warehouseInventory } from "@shared/schema";
import type { IWarehouseStockMovementsRepository } from "@modules/inventory/application/inventory/contracts/IWarehouseStockMovementsRepository";
import type { StockMovementWithDetails, WarehouseInventory } from '@shared/schema';

export class DrizzleWarehouseStockMovementsRepository implements IWarehouseStockMovementsRepository {
  constructor(private readonly executor: any) {}

  async getStockMovements(limit: number = 50): Promise<StockMovementWithDetails[]> {
    const rows = await this.executor
      .select({
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
        technicianName: users.fullName,
      })
      .from(stockMovements)
      .leftJoin(users, eq(stockMovements.technicianId, users.id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return rows.map((row: any) => ({
      ...row,
      technicianName: row.technicianName || undefined,
      performedByName: undefined,
      itemNameAr: row.itemType,
    }));
  }

  async getStockMovementsByRegion(regionId: string | null): Promise<StockMovementWithDetails[]> {
    if (!regionId) {
      return [];
    }

    const rows = await this.executor
      .select({
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
        technicianName: users.fullName,
      })
      .from(stockMovements)
      .leftJoin(users, eq(stockMovements.technicianId, users.id))
      .where(eq(users.regionId, regionId))
      .orderBy(desc(stockMovements.createdAt));

    return rows.map((row: any) => ({
      ...row,
      technicianName: row.technicianName || undefined,
      performedByName: undefined,
      itemNameAr: row.itemType,
    }));
  }

  async getStockMovementsByTechnician(technicianId: string, limit: number = 50): Promise<StockMovementWithDetails[]> {
    const rows = await this.executor
      .select({
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
        technicianName: users.fullName,
      })
      .from(stockMovements)
      .leftJoin(users, eq(stockMovements.technicianId, users.id))
      .where(eq(stockMovements.technicianId, technicianId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return rows.map((row: any) => ({
      ...row,
      technicianName: row.technicianName || undefined,
      performedByName: undefined,
      itemNameAr: row.itemType,
    }));
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
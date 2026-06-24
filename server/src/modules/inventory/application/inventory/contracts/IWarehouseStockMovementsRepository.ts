import type { StockMovementWithDetails, WarehouseInventory } from '@shared/schema';

export interface IWarehouseStockMovementsRepository {
  getStockMovements(limit?: number): Promise<StockMovementWithDetails[]>;
  getStockMovementsByRegion(regionId: string | null): Promise<StockMovementWithDetails[]>;
  getStockMovementsByTechnician(technicianId: string, limit?: number): Promise<StockMovementWithDetails[]>;
  getSupervisorWarehouseIds(supervisorId: string): Promise<string[]>;
  getWarehouseInventoryByWarehouseId(warehouseId: string): Promise<WarehouseInventory[]>;
}
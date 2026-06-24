import type { InsertRegion, Region } from "@shared/schema";

export type RegionInventoryStats = {
  itemCount: number;
  totalQuantity: number;
  lowStockCount: number;
};

export interface IRegionRepository {
  findAll(): Promise<Region[]>;
  findById(id: string): Promise<Region | undefined>;
  create(data: InsertRegion): Promise<Region>;
  update(id: string, updates: Partial<InsertRegion>): Promise<Region>;
  delete(id: string): Promise<boolean>;
  countUsersByRegionId(regionId: string): Promise<number>;
  countWarehousesByRegionId(regionId: string): Promise<number>;
  getInventoryStatsByRegionId(regionId: string): Promise<RegionInventoryStats>;
}

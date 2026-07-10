import { and, eq, sql } from 'drizzle-orm';
import type { IRegionRepository, RegionInventoryStats } from '../../application/regions/contracts/IRegionRepository';
import { getDatabase } from "@core/database/connection";
import { inventoryItems, regions, users, warehouses, type InsertRegion, type Region } from "@shared/schema";

export class DrizzleRegionRepository implements IRegionRepository {
  private get db() {
    return getDatabase();
  }

  async findAll(): Promise<Region[]> {
    return this.db
      .select()
      .from(regions)
      .orderBy(regions.name);
  }

  async findById(id: string): Promise<Region | undefined> {
    const [region] = await this.db
      .select()
      .from(regions)
      .where(eq(regions.id, id));

    return region || undefined;
  }

  async create(data: InsertRegion): Promise<Region> {
    const [region] = await this.db
      .insert(regions)
      .values(data)
      .returning();

    return region;
  }

  async update(id: string, updates: Partial<InsertRegion>): Promise<Region> {
    const [region] = await this.db
      .update(regions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(regions.id, id))
      .returning();

    if (!region) {
      throw new Error(`Region with id ${id} not found`);
    }

    return region;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(regions)
      .where(eq(regions.id, id));

    return (result.rowCount || 0) > 0;
  }

  async countUsersByRegionId(regionId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.regionId, regionId));

    return Number(row?.count || 0);
  }

  async countWarehousesByRegionId(regionId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(warehouses)
      .where(eq(warehouses.regionId, regionId));

    return Number(row?.count || 0);
  }

  async getInventoryStatsByRegionId(regionId: string): Promise<RegionInventoryStats> {
    const [itemCountRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(eq(inventoryItems.regionId, regionId));

    const [totalQuantityRow] = await this.db
      .select({ total: sql<number>`coalesce(sum(${inventoryItems.quantity}), 0)` })
      .from(inventoryItems)
      .where(eq(inventoryItems.regionId, regionId));

    const [lowStockCountRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.regionId, regionId),
          sql`${inventoryItems.quantity} <= ${inventoryItems.minThreshold}`,
        ),
      );

    return {
      itemCount: Number(itemCountRow?.count || 0),
      totalQuantity: Number(totalQuantityRow?.total || 0),
      lowStockCount: Number(lowStockCountRow?.count || 0),
    };
  }
}

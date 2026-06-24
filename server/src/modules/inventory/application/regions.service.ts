import { db } from "@core/config/db";
import { 
  regions,
  users,
  warehouses,
  type Region,
  type InsertRegion,
  type RegionWithStats
} from "@shared/schema";
import { eq, sql, count } from "drizzle-orm";

/**
 * Regions Management Service
 * Handles all region-related operations
 */
export class RegionsService {

  /**
   * Get all regions with statistics
   */
  async getRegions(): Promise<RegionWithStats[]> {
    const regionsWithStats = await db
      .select({
        id: regions.id,
        name: regions.name,
        description: regions.description,
        isActive: regions.isActive,
        createdAt: regions.createdAt,
        updatedAt: regions.updatedAt,
        totalUsers: sql<number>`COALESCE(COUNT(DISTINCT ${users.id}), 0)`,
        totalWarehouses: sql<number>`COALESCE(COUNT(DISTINCT ${warehouses.id}), 0)`,
        totalTechnicians: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'technician' THEN 1 END), 0)`,
        totalSupervisors: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'supervisor' THEN 1 END), 0)`,
        itemCount: sql<number>`0`,
        totalQuantity: sql<number>`0`,
        lowStockCount: sql<number>`0`,
      })
      .from(regions)
      .leftJoin(users, eq(regions.id, users.regionId))
      .leftJoin(warehouses, eq(regions.id, warehouses.regionId))
      .groupBy(regions.id);

    return regionsWithStats;
  }

  /**
   * Get single region by ID
   */
  async getRegion(id: string): Promise<Region | undefined> {
    const [region] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, id))
      .limit(1);

    return region || undefined;
  }

  /**
   * Create new region
   */
  async createRegion(insertRegion: InsertRegion): Promise<Region> {
    const [newRegion] = await db
      .insert(regions)
      .values({
        ...insertRegion,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newRegion) {
      throw new Error("Failed to create region");
    }

    return newRegion;
  }

  /**
   * Update region
   */
  async updateRegion(id: string, updates: Partial<InsertRegion>): Promise<Region> {
    const [updatedRegion] = await db
      .update(regions)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(regions.id, id))
      .returning();

    if (!updatedRegion) {
      throw new Error("Region not found");
    }

    return updatedRegion;
  }

  /**
   * Delete region
   */
  async deleteRegion(id: string): Promise<boolean> {
    // Check if region has users or warehouses
    const [userCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.regionId, id));

    const [warehouseCount] = await db
      .select({ count: count() })
      .from(warehouses)
      .where(eq(warehouses.regionId, id));

    if (userCount.count > 0 || warehouseCount.count > 0) {
      throw new Error("Cannot delete region that has users or warehouses");
    }

    const result = await db
      .delete(regions)
      .where(eq(regions.id, id));

    return (result as any).changes > 0;
  }

  /**
   * Get active regions
   */
  async getActiveRegions(): Promise<Region[]> {
    return db
      .select()
      .from(regions)
      .where(eq(regions.isActive, true));
  }

  /**
   * Get region by name
   */
  async getRegionByName(name: string): Promise<Region | undefined> {
    const [region] = await db
      .select()
      .from(regions)
      .where(eq(regions.name, name))
      .limit(1);

    return region || undefined;
  }

  /**
   * Toggle region active status
   */
  async toggleRegionStatus(id: string): Promise<Region> {
    const region = await this.getRegion(id);
    if (!region) {
      throw new Error("Region not found");
    }

    return this.updateRegion(id, { isActive: !region.isActive });
  }

  /**
   * Get region statistics
   */
  async getRegionStatistics(regionId: string) {
    const [stats] = await db
      .select({
        totalUsers: sql<number>`COUNT(DISTINCT ${users.id})`,
        totalTechnicians: sql<number>`COUNT(CASE WHEN ${users.role} = 'technician' THEN 1 END)`,
        totalSupervisors: sql<number>`COUNT(CASE WHEN ${users.role} = 'supervisor' THEN 1 END)`,
        totalAdmins: sql<number>`COUNT(CASE WHEN ${users.role} = 'admin' THEN 1 END)`,
        totalWarehouses: sql<number>`(SELECT COUNT(*) FROM ${warehouses} WHERE region_id = ${regionId})`,
        activeUsers: sql<number>`COUNT(CASE WHEN ${users.isActive} = true THEN 1 END)`
      })
      .from(users)
      .where(eq(users.regionId, regionId));

    return stats;
  }

  /**
   * Search regions
   */
  async searchRegions(query: string): Promise<RegionWithStats[]> {
    const regionsWithStats = await db
      .select({
        id: regions.id,
        name: regions.name,
        description: regions.description,
        isActive: regions.isActive,
        createdAt: regions.createdAt,
        updatedAt: regions.updatedAt,
        totalUsers: sql<number>`COALESCE(COUNT(DISTINCT ${users.id}), 0)`,
        totalWarehouses: sql<number>`COALESCE(COUNT(DISTINCT ${warehouses.id}), 0)`,
        totalTechnicians: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'technician' THEN 1 END), 0)`,
        totalSupervisors: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'supervisor' THEN 1 END), 0)`,
        itemCount: sql<number>`0`,
        totalQuantity: sql<number>`0`,
        lowStockCount: sql<number>`0`,
      })
      .from(regions)
      .leftJoin(users, eq(regions.id, users.regionId))
      .leftJoin(warehouses, eq(regions.id, warehouses.regionId))
      .where(
        sql`${regions.name} ILIKE ${`%${query}%`} OR ${regions.description} ILIKE ${`%${query}%`}`
      )
      .groupBy(regions.id);

    return regionsWithStats;
  }

  /**
   * Get regions with pagination
   */
  async getRegionsWithPagination(page: number = 1, pageSize: number = 10) {
    const offset = (page - 1) * pageSize;

    const [totalCount] = await db
      .select({ count: count() })
      .from(regions);

    const regionsData = await db
      .select({
        id: regions.id,
        name: regions.name,
        description: regions.description,
        isActive: regions.isActive,
        createdAt: regions.createdAt,
        updatedAt: regions.updatedAt,
        totalUsers: sql<number>`COALESCE(COUNT(DISTINCT ${users.id}), 0)`,
        totalWarehouses: sql<number>`COALESCE(COUNT(DISTINCT ${warehouses.id}), 0)`,
        totalTechnicians: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'technician' THEN 1 END), 0)`,
        totalSupervisors: sql<number>`COALESCE(COUNT(CASE WHEN ${users.role} = 'supervisor' THEN 1 END), 0)`
      })
      .from(regions)
      .leftJoin(users, eq(regions.id, users.regionId))
      .leftJoin(warehouses, eq(regions.id, warehouses.regionId))
      .groupBy(regions.id)
      .limit(pageSize)
      .offset(offset);

    return {
      data: regionsData,
      pagination: {
        page,
        pageSize,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / pageSize)
      }
    };
  }
}
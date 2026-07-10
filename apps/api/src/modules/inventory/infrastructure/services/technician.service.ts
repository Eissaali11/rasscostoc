import { db } from "@core/config/db";
import { 
  techniciansInventory,
  technicianFixedInventories,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  stockMovements,
  users,
  regions,
  itemTypes,
  type TechnicianInventory,
  type TechnicianFixedInventory,
  type TechnicianFixedInventoryEntry,
  type TechnicianMovingInventoryEntry,
  type StockMovement,
  type InsertTechnicianInventory,
  type InsertTechnicianFixedInventory,
  type InsertStockMovement,
  type TechnicianWithFixedInventory,
  type FixedInventorySummary,
  type StockMovementWithDetails
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Technician Management Service
 * Handles all technician-related operations including inventories and stock movements
 */
export class TechnicianService {

  /**
   * Get all technicians inventory
   */
  async getTechniciansInventory(): Promise<TechnicianInventory[]> {
    return db
      .select()
      .from(techniciansInventory)
      .orderBy(desc(techniciansInventory.createdAt));
  }

  /**
   * Get single technician inventory
   */
  async getTechnicianInventory(id: string): Promise<TechnicianInventory | undefined> {
    const [inventory] = await db
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.id, id))
      .limit(1);

    return inventory || undefined;
  }

  /**
   * Create technician inventory
   */
  async createTechnicianInventory(data: InsertTechnicianInventory): Promise<TechnicianInventory> {
    const [newInventory] = await db
      .insert(techniciansInventory)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newInventory) {
      throw new Error("Failed to create technician inventory");
    }

    return newInventory;
  }

  /**
   * Update technician inventory
   */
  async updateTechnicianInventory(id: string, updates: Partial<InsertTechnicianInventory>): Promise<TechnicianInventory> {
    const [updatedInventory] = await db
      .update(techniciansInventory)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(techniciansInventory.id, id))
      .returning();

    if (!updatedInventory) {
      throw new Error("Technician inventory not found");
    }

    return updatedInventory;
  }

  /**
   * Delete technician inventory
   */
  async deleteTechnicianInventory(id: string): Promise<boolean> {
    const result = await db
      .delete(techniciansInventory)
      .where(eq(techniciansInventory.id, id));

    return (result as any).changes > 0;
  }

  /**
   * Get technician fixed inventory
   */
  async getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    const [fixedInventory] = await db
      .select()
      .from(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId))
      .limit(1);

    return fixedInventory || undefined;
  }

  /**
   * Create technician fixed inventory
   */
  async createTechnicianFixedInventory(data: InsertTechnicianFixedInventory): Promise<TechnicianFixedInventory> {
    const [newFixedInventory] = await db
      .insert(technicianFixedInventories)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newFixedInventory) {
      throw new Error("Failed to create technician fixed inventory");
    }

    return newFixedInventory;
  }

  /**
   * Update technician fixed inventory
   */
  async updateTechnicianFixedInventory(technicianId: string, updates: Partial<InsertTechnicianFixedInventory>): Promise<TechnicianFixedInventory> {
    const [updatedInventory] = await db
      .update(technicianFixedInventories)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(technicianFixedInventories.technicianId, technicianId))
      .returning();

    if (!updatedInventory) {
      throw new Error("Technician fixed inventory not found");
    }

    return updatedInventory;
  }

  /**
   * Delete technician fixed inventory
   */
  async deleteTechnicianFixedInventory(technicianId: string): Promise<void> {
    await db
      .delete(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId));
  }

  /**
   * Get all technicians with their fixed inventories
   */
  async getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]> {
    const technicians = await db
      .select({
        technicianId: users.id,
        technicianName: users.fullName,
        city: users.city,
      })
      .from(users)
      .where(eq(users.role, 'technician'))
      .orderBy(users.fullName);

    const result: TechnicianWithFixedInventory[] = [];

    for (const technician of technicians) {
      const fixedInventory = await this.getTechnicianFixedInventory(technician.technicianId);
      result.push({
        technicianId: technician.technicianId,
        technicianName: technician.technicianName,
        city: technician.city || "",
        fixedInventory: fixedInventory || null,
        alertLevel: fixedInventory ? 'good' : 'warning',
      });
    }

    return result;
  }

  /**
   * Get technician fixed inventory entries
   */
  async getTechnicianFixedInventoryEntries(technicianId: string): Promise<TechnicianFixedInventoryEntry[]> {
    return db
      .select()
      .from(technicianFixedInventoryEntries)
      .where(eq(technicianFixedInventoryEntries.technicianId, technicianId));
  }

  /**
   * Upsert technician fixed inventory entry
   */
  async upsertTechnicianFixedInventoryEntry(
    technicianId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<TechnicianFixedInventoryEntry> {
    // Check if entry exists
    const [existing] = await db
      .select()
      .from(technicianFixedInventoryEntries)
      .where(
        and(
          eq(technicianFixedInventoryEntries.technicianId, technicianId),
          eq(technicianFixedInventoryEntries.itemTypeId, itemTypeId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(technicianFixedInventoryEntries)
        .set({
          boxes,
          units,
          updatedAt: new Date()
        })
        .where(eq(technicianFixedInventoryEntries.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update technician fixed inventory entry");
      }

      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(technicianFixedInventoryEntries)
        .values({
          technicianId,
          itemTypeId,
          boxes,
          units,
          updatedAt: new Date()
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create technician fixed inventory entry");
      }

      return created;
    }
  }

  /**
   * Get technician moving inventory entries
   */
  async getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]> {
    return db
      .select()
      .from(technicianMovingInventoryEntries)
      .where(eq(technicianMovingInventoryEntries.technicianId, technicianId));
  }

  /**
   * Upsert technician moving inventory entry
   */
  async upsertTechnicianMovingInventoryEntry(
    technicianId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<TechnicianMovingInventoryEntry> {
    // Check if entry exists
    const [existing] = await db
      .select()
      .from(technicianMovingInventoryEntries)
      .where(
        and(
          eq(technicianMovingInventoryEntries.technicianId, technicianId),
          eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(technicianMovingInventoryEntries)
        .set({
          boxes,
          units,
          updatedAt: new Date()
        })
        .where(eq(technicianMovingInventoryEntries.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update technician moving inventory entry");
      }

      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(technicianMovingInventoryEntries)
        .values({
          technicianId,
          itemTypeId,
          boxes,
          units,
          updatedAt: new Date()
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create technician moving inventory entry");
      }

      return created;
    }
  }

  /**
   * Get stock movements
   */
  async getStockMovements(technicianId?: string, limit: number = 50): Promise<StockMovementWithDetails[]> {
    let query = db
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
      .$dynamic();

    if (technicianId) {
      query = query.where(eq(stockMovements.technicianId, technicianId));
    }

    const movements = await query
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    return movements.map((movement) => ({
      ...movement,
      technicianName: movement.technicianName || undefined,
    }));
  }

  /**
   * Create stock movement
   */
  async createStockMovement(data: InsertStockMovement): Promise<StockMovement> {
    const [newMovement] = await db
      .insert(stockMovements)
      .values({
        ...data,
        createdAt: new Date()
      })
      .returning();

    if (!newMovement) {
      throw new Error("Failed to create stock movement");
    }

    return newMovement;
  }

  /**
   * Get stock movements by region
   */
  async getStockMovementsByRegion(regionId: string): Promise<StockMovementWithDetails[]> {
    const movements = await db
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

    return movements.map((movement) => ({
      ...movement,
      technicianName: movement.technicianName || undefined,
    }));
  }

  /**
   * Get stock movements by technician
   */
  async getStockMovementsByTechnician(technicianId: string): Promise<StockMovementWithDetails[]> {
    return this.getStockMovements(technicianId);
  }

  /**
   * Calculate fixed inventory summary for a region
   */
  async getFixedInventorySummaryByRegion(regionId: string): Promise<FixedInventorySummary> {
    const [summary] = await db
      .select({
        totalN950: sql<number>`COALESCE(SUM(${technicianFixedInventories.n950Boxes} * 10 + ${technicianFixedInventories.n950Units}), 0)`,
        totalI9000s: sql<number>`COALESCE(SUM(${technicianFixedInventories.i9000sBoxes} * 10 + ${technicianFixedInventories.i9000sUnits}), 0)`,
        totalI9100: sql<number>`COALESCE(SUM(${technicianFixedInventories.i9100Boxes} * 10 + ${technicianFixedInventories.i9100Units}), 0)`,
        totalRollPaper: sql<number>`COALESCE(SUM(${technicianFixedInventories.rollPaperBoxes} * 10 + ${technicianFixedInventories.rollPaperUnits}), 0)`,
        totalStickers: sql<number>`COALESCE(SUM(${technicianFixedInventories.stickersBoxes} * 10 + ${technicianFixedInventories.stickersUnits}), 0)`,
        totalNewBatteries: sql<number>`COALESCE(SUM(${technicianFixedInventories.newBatteriesBoxes} * 10 + ${technicianFixedInventories.newBatteriesUnits}), 0)`,
        totalMobilySim: sql<number>`COALESCE(SUM(${technicianFixedInventories.mobilySimBoxes} * 10 + ${technicianFixedInventories.mobilySimUnits}), 0)`,
        totalStcSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.stcSimBoxes} * 10 + ${technicianFixedInventories.stcSimUnits}), 0)`,
        totalZainSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.zainSimBoxes} * 10 + ${technicianFixedInventories.zainSimUnits}), 0)`,
        totalTechnicians: sql<number>`COUNT(DISTINCT ${technicianFixedInventories.technicianId})`
      })
      .from(technicianFixedInventories)
      .leftJoin(users, eq(technicianFixedInventories.technicianId, users.id))
      .where(eq(users.regionId, regionId));

    const techniciansCount = summary?.totalTechnicians || 0;

    return {
      totalN950: summary?.totalN950 || 0,
      totalI9000s: summary?.totalI9000s || 0,
      totalI9100: summary?.totalI9100 || 0,
      totalRollPaper: summary?.totalRollPaper || 0,
      totalStickers: summary?.totalStickers || 0,
      totalNewBatteries: summary?.totalNewBatteries || 0,
      totalMobilySim: summary?.totalMobilySim || 0,
      totalStcSim: summary?.totalStcSim || 0,
      totalZainSim: summary?.totalZainSim || 0,
      techniciansWithCriticalStock: 0,
      techniciansWithWarningStock: 0,
      techniciansWithGoodStock: techniciansCount,
    };
  }

  /**
   * Get technicians with both fixed and moving inventories
   */
  async getAllTechniciansWithBothInventories() {
    const technicians = await db
      .select({
        technicianId: users.id,
        fullName: users.fullName,
        username: users.username,
        city: users.city,
        regionName: regions.name,
        regionId: users.regionId
      })
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(eq(users.role, 'technician'))
      .orderBy(users.fullName);

    const result = [];
    for (const tech of technicians) {
      const fixedEntries = await this.getTechnicianFixedInventoryEntries(tech.technicianId);
      const movingEntries = await this.getTechnicianMovingInventoryEntries(tech.technicianId);
      
      result.push({
        ...tech,
        fixedInventory: fixedEntries,
        movingInventory: movingEntries
      });
    }

    return result;
  }

  /**
   * Get region technicians with inventories
   */
  async getRegionTechniciansWithInventories(regionId: string) {
    const technicians = await db
      .select({
        technicianId: users.id,
        fullName: users.fullName,
        username: users.username,
        city: users.city,
        regionName: regions.name,
        regionId: users.regionId
      })
      .from(users)
      .leftJoin(regions, eq(users.regionId, regions.id))
      .where(and(eq(users.role, 'technician'), eq(users.regionId, regionId)))
      .orderBy(users.fullName);

    const result = [];
    for (const tech of technicians) {
      const fixedEntries = await this.getTechnicianFixedInventoryEntries(tech.technicianId);
      const movingEntries = await this.getTechnicianMovingInventoryEntries(tech.technicianId);
      
      result.push({
        ...tech,
        fixedInventory: fixedEntries,
        movingInventory: movingEntries
      });
    }

    return result;
  }
}
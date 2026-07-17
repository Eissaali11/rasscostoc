import { db } from "@core/config/db";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";
import {
  techniciansInventory,
  technicianFixedInventories,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  stockMovements,
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
import { eq, and, desc, sql, inArray } from "drizzle-orm";

/**
 * Technician Management Service
 * Handles all technician-related operations including inventories and stock movements
 */
export class TechnicianService {

  private async listTechniciansWithRegionName(regionId?: string) {
    const directory = await getInventoryIdentityPorts().listTechnicians(regionId ? { regionId } : undefined);
    const sorted = [...directory].sort((a, b) => a.fullName.localeCompare(b.fullName));

    const distinctRegionIds = [...new Set(sorted.map((t) => t.regionId).filter(Boolean))] as string[];
    const regionRows = distinctRegionIds.length > 0
      ? await db.select({ id: regions.id, name: regions.name }).from(regions).where(inArray(regions.id, distinctRegionIds))
      : [];
    const regionNameById = new Map(regionRows.map((r) => [r.id, r.name]));

    return sorted.map((t) => ({
      technicianId: t.id,
      fullName: t.fullName,
      username: t.username,
      city: t.city,
      regionId: t.regionId,
      regionName: t.regionId ? regionNameById.get(t.regionId) : undefined,
    }));
  }

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
    const directory = await getInventoryIdentityPorts().listTechnicians();
    const technicians = [...directory]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((t) => ({ technicianId: t.id, technicianName: t.fullName, city: t.city }));

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
      })
      .from(stockMovements)
      .$dynamic();

    if (technicianId) {
      query = query.where(eq(stockMovements.technicianId, technicianId));
    }

    const rows = await query
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    const technicianIds = [...new Set(rows.map((r) => r.technicianId).filter(Boolean))];
    const techsById = await getInventoryIdentityPorts().getUsersByIds(technicianIds as string[]);

    return rows.map((movement) => ({
      ...movement,
      technicianName: movement.technicianId ? techsById.get(movement.technicianId)?.fullName : undefined,
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
    const ports = getInventoryIdentityPorts();
    const technicianIdsInRegion = await ports.getUserIdsByRegion(regionId);
    if (technicianIdsInRegion.length === 0) return [];

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
      })
      .from(stockMovements)
      .where(inArray(stockMovements.technicianId, technicianIdsInRegion as string[]))
      .orderBy(desc(stockMovements.createdAt));

    const techsById = await ports.getUsersByIds(technicianIdsInRegion);

    return movements.map((movement) => ({
      ...movement,
      technicianName: movement.technicianId ? techsById.get(movement.technicianId)?.fullName : undefined,
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
    const technicianIdsInRegion = await getInventoryIdentityPorts().getUserIdsByRegion(regionId);
    if (technicianIdsInRegion.length === 0) {
      return {
        totalN950: 0, totalI9000s: 0, totalI9100: 0, totalRollPaper: 0, totalStickers: 0,
        totalNewBatteries: 0, totalMobilySim: 0, totalStcSim: 0, totalZainSim: 0, totalLebaraSim: 0,
        techniciansWithCriticalStock: 0, techniciansWithWarningStock: 0, techniciansWithGoodStock: 0,
      };
    }

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
        totalLebaraSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.lebaraBoxes} * 10 + ${technicianFixedInventories.lebaraUnits}), 0)`,
        totalTechnicians: sql<number>`COUNT(DISTINCT ${technicianFixedInventories.technicianId})`
      })
      .from(technicianFixedInventories)
      .where(inArray(technicianFixedInventories.technicianId, technicianIdsInRegion as string[]));

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
      totalLebaraSim: summary?.totalLebaraSim || 0,
      techniciansWithCriticalStock: 0,
      techniciansWithWarningStock: 0,
      techniciansWithGoodStock: techniciansCount,
    };
  }

  /**
   * Get technicians with both fixed and moving inventories
   */
  async getAllTechniciansWithBothInventories() {
    const technicians = await this.listTechniciansWithRegionName();

    if (technicians.length === 0) return [];

    const ids = technicians.map((tech) => tech.technicianId);
    const [allFixed, allMoving] = await Promise.all([
      db
        .select()
        .from(technicianFixedInventoryEntries)
        .where(inArray(technicianFixedInventoryEntries.technicianId, ids)),
      db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(inArray(technicianMovingInventoryEntries.technicianId, ids)),
    ]);

    const fixedByTech = new Map<string, typeof allFixed>();
    for (const entry of allFixed) {
      const list = fixedByTech.get(entry.technicianId) || [];
      list.push(entry);
      fixedByTech.set(entry.technicianId, list);
    }

    const movingByTech = new Map<string, typeof allMoving>();
    for (const entry of allMoving) {
      const list = movingByTech.get(entry.technicianId) || [];
      list.push(entry);
      movingByTech.set(entry.technicianId, list);
    }

    return technicians.map((tech) => ({
      ...tech,
      fixedInventory: fixedByTech.get(tech.technicianId) || [],
      movingInventory: movingByTech.get(tech.technicianId) || [],
    }));
  }

  /**
   * Get region technicians with inventories
   */
  async getRegionTechniciansWithInventories(regionId: string) {
    const technicians = await this.listTechniciansWithRegionName(regionId);

    if (technicians.length === 0) return [];

    const ids = technicians.map((tech) => tech.technicianId);
    const [allFixed, allMoving] = await Promise.all([
      db
        .select()
        .from(technicianFixedInventoryEntries)
        .where(inArray(technicianFixedInventoryEntries.technicianId, ids)),
      db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(inArray(technicianMovingInventoryEntries.technicianId, ids)),
    ]);

    const fixedByTech = new Map<string, typeof allFixed>();
    for (const entry of allFixed) {
      const list = fixedByTech.get(entry.technicianId) || [];
      list.push(entry);
      fixedByTech.set(entry.technicianId, list);
    }

    const movingByTech = new Map<string, typeof allMoving>();
    for (const entry of allMoving) {
      const list = movingByTech.get(entry.technicianId) || [];
      list.push(entry);
      movingByTech.set(entry.technicianId, list);
    }

    return technicians.map((tech) => ({
      ...tech,
      fixedInventory: fixedByTech.get(tech.technicianId) || [],
      movingInventory: movingByTech.get(tech.technicianId) || [],
    }));
  }
}
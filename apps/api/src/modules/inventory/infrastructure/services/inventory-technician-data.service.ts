import { db } from "@core/config/db";
import { eq, inArray } from "drizzle-orm";
import {
  technicianFixedInventories,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  techniciansInventory,
  inventoryRequests,
} from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * ERP-005A-4 Phase 4B — inventory-owned implementation backing
 * identity's InventoryTechnicianDataPort. Lives in inventory because it
 * owns technician_fixed_inventories, technician_fixed_inventory_entries,
 * technician_moving_inventory_entries, technicians_inventory, and
 * inventory_requests.
 */
export class InventoryTechnicianDataService {
  async getFixedInventoryByTechnicianId(technicianId: string) {
    const [row] = await db
      .select()
      .from(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId))
      .limit(1);
    return row || null;
  }

  async getFixedInventorySummaryTotals() {
    const [summary] = await db
      .select({
        totalN950: sql<number>`COALESCE(SUM(${technicianFixedInventories.n950Boxes} + ${technicianFixedInventories.n950Units}), 0)`,
        totalI9000s: sql<number>`COALESCE(SUM(${technicianFixedInventories.i9000sBoxes} + ${technicianFixedInventories.i9000sUnits}), 0)`,
        totalI9100: sql<number>`COALESCE(SUM(${technicianFixedInventories.i9100Boxes} + ${technicianFixedInventories.i9100Units}), 0)`,
        totalRollPaper: sql<number>`COALESCE(SUM(${technicianFixedInventories.rollPaperBoxes} + ${technicianFixedInventories.rollPaperUnits}), 0)`,
        totalStickers: sql<number>`COALESCE(SUM(${technicianFixedInventories.stickersBoxes} + ${technicianFixedInventories.stickersUnits}), 0)`,
        totalNewBatteries: sql<number>`COALESCE(SUM(${technicianFixedInventories.newBatteriesBoxes} + ${technicianFixedInventories.newBatteriesUnits}), 0)`,
        totalMobilySim: sql<number>`COALESCE(SUM(${technicianFixedInventories.mobilySimBoxes} + ${technicianFixedInventories.mobilySimUnits}), 0)`,
        totalStcSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.stcSimBoxes} + ${technicianFixedInventories.stcSimUnits}), 0)`,
        totalZainSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.zainSimBoxes} + ${technicianFixedInventories.zainSimUnits}), 0)`,
        totalLebaraSim: sql<number>`COALESCE(SUM(${technicianFixedInventories.lebaraBoxes} + ${technicianFixedInventories.lebaraUnits}), 0)`,
        technicianCount: sql<number>`COUNT(*)`,
      })
      .from(technicianFixedInventories);

    return {
      totalN950: Number(summary?.totalN950 || 0),
      totalI9000s: Number(summary?.totalI9000s || 0),
      totalI9100: Number(summary?.totalI9100 || 0),
      totalRollPaper: Number(summary?.totalRollPaper || 0),
      totalStickers: Number(summary?.totalStickers || 0),
      totalNewBatteries: Number(summary?.totalNewBatteries || 0),
      totalMobilySim: Number(summary?.totalMobilySim || 0),
      totalStcSim: Number(summary?.totalStcSim || 0),
      totalZainSim: Number(summary?.totalZainSim || 0),
      totalLebaraSim: Number(summary?.totalLebaraSim || 0),
      technicianCount: Number(summary?.technicianCount || 0),
    };
  }

  async getFixedAndMovingEntriesByTechnicianIds(technicianIds: readonly string[]) {
    if (technicianIds.length === 0) {
      return { fixedByTechnicianId: new Map(), movingByTechnicianId: new Map() };
    }
    const ids = technicianIds as string[];
    const [allFixed, allMoving] = await Promise.all([
      db.select().from(technicianFixedInventoryEntries).where(inArray(technicianFixedInventoryEntries.technicianId, ids)),
      db.select().from(technicianMovingInventoryEntries).where(inArray(technicianMovingInventoryEntries.technicianId, ids)),
    ]);

    const fixedByTechnicianId = new Map<string, typeof allFixed>();
    for (const entry of allFixed) {
      const list = fixedByTechnicianId.get(entry.technicianId) || [];
      list.push(entry);
      fixedByTechnicianId.set(entry.technicianId, list);
    }

    const movingByTechnicianId = new Map<string, typeof allMoving>();
    for (const entry of allMoving) {
      const list = movingByTechnicianId.get(entry.technicianId) || [];
      list.push(entry);
      movingByTechnicianId.set(entry.technicianId, list);
    }

    return { fixedByTechnicianId, movingByTechnicianId };
  }

  async getAllInventoryRequests() {
    return db.select().from(inventoryRequests).orderBy(inventoryRequests.createdAt);
  }

  async getPendingInventoryRequestsCount(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(inventoryRequests)
      .where(eq(inventoryRequests.status, "pending"));
    return Number(row?.count || 0);
  }

  async getMovingInventoryByCreatedBy(technicianId: string) {
    const [row] = await db
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.createdBy, technicianId))
      .limit(1);
    return row || null;
  }
}

export const inventoryTechnicianDataService = new InventoryTechnicianDataService();

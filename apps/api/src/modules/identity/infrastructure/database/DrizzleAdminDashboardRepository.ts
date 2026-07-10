import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';
import { sql, eq, desc } from 'drizzle-orm';
import type { IAdminDashboardRepository } from '@stockpro/contracts';
import { getDatabase } from '@core/database/connection';
import {
  users,
  technicianFixedInventories,
  technicianFixedInventoryEntries,
  technicianMovingInventoryEntries,
  inventoryRequests,
} from '@shared/schema';

export class DrizzleAdminDashboardRepository implements IAdminDashboardRepository {
  private get db() {
    return getDatabase();
  }

  async getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]> {
    const technicians = await this.db
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
      const [fixedInventory] = await this.db
        .select()
        .from(technicianFixedInventories)
        .where(eq(technicianFixedInventories.technicianId, technician.technicianId))
        .limit(1);

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

  async getFixedInventorySummary(): Promise<FixedInventorySummary> {
    const [summary] = await this.db
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
        techniciansWithCriticalStock: sql<number>`0`,
        techniciansWithWarningStock: sql<number>`0`,
        techniciansWithGoodStock: sql<number>`COUNT(*)`,
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
      techniciansWithCriticalStock: Number(summary?.techniciansWithCriticalStock || 0),
      techniciansWithWarningStock: Number(summary?.techniciansWithWarningStock || 0),
      techniciansWithGoodStock: Number(summary?.techniciansWithGoodStock || 0),
    };
  }

  async getAllTechniciansWithBothInventories(): Promise<TechnicianWithBothInventories[]> {
    const technicians = await this.db
      .select({
        technicianId: users.id,
        fullName: users.fullName,
        username: users.username,
        city: users.city,
        regionId: users.regionId
      })
      .from(users)
      .where(eq(users.role, 'technician'))
      .orderBy(users.fullName);

    const result: TechnicianWithBothInventories[] = [];
    for (const tech of technicians) {
      const fixedEntries = await this.db
        .select()
        .from(technicianFixedInventoryEntries)
        .where(eq(technicianFixedInventoryEntries.technicianId, tech.technicianId));

      const movingEntries = await this.db
        .select()
        .from(technicianMovingInventoryEntries)
        .where(eq(technicianMovingInventoryEntries.technicianId, tech.technicianId));

      result.push({
        technicianId: tech.technicianId,
        technicianName: tech.fullName,
        city: tech.city || 'غير محدد',
        regionId: tech.regionId,
        fixedInventory: fixedEntries.length ? { entries: fixedEntries } : null,
        movingInventory: movingEntries.length ? { entries: movingEntries } : null,
        alertLevel: 'good' as const,
      });
    }

    return result;
  }

  async getInventoryRequests(): Promise<InventoryRequest[]> {
    const rows = await this.db
      .select({
        request: inventoryRequests,
        technicianName: users.fullName,
      })
      .from(inventoryRequests)
      .leftJoin(users, eq(inventoryRequests.technicianId, users.id))
      .orderBy(desc(inventoryRequests.createdAt));

    return rows.map((row: any) => ({
      ...row.request,
      technicianName: row.technicianName || 'غير معروف',
    }));
  }

  async getPendingInventoryRequestsCount(): Promise<number> {
    const rows = await this.db
      .select()
      .from(inventoryRequests)
      .where(eq(inventoryRequests.status, 'pending'));

    return rows.length;
  }
}

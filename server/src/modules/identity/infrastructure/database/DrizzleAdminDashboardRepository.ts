import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import type { IAdminDashboardRepository } from '@modules/identity/application/admin/contracts/IAdminDashboardRepository';
import { getDatabase } from '@core/database/connection';
import { technicianFixedInventories } from '@shared/schema';
import { repositories } from '@modules/inventory/infrastructure/database';
import { TechnicianService } from '@modules/inventory/application/technician.service';
import { DrizzleStockFixedInventoryRepository } from '@modules/inventory/infrastructure/database/DrizzleStockFixedInventoryRepository';

export class DrizzleAdminDashboardRepository implements IAdminDashboardRepository {
  private readonly technicianService = new TechnicianService();
  private readonly fixedInventoryRepository = new DrizzleStockFixedInventoryRepository();

  private get db() {
    return getDatabase();
  }

  async getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]> {
    return this.technicianService.getAllTechniciansWithFixedInventory();
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
    // Use TechnicianService which reads from the entry-based tables (not legacy)
    const technicians = await this.technicianService.getAllTechniciansWithBothInventories();

    return technicians.map((tech) => ({
      technicianId: tech.technicianId,
      technicianName: tech.fullName,
      city: tech.city || 'غير محدد',
      regionId: tech.regionId,
      fixedInventory: tech.fixedInventory?.length
        ? { entries: tech.fixedInventory }
        : null,
      movingInventory: tech.movingInventory?.length
        ? { entries: tech.movingInventory }
        : null,
      alertLevel: 'good' as const,
    }));
  }

  async getInventoryRequests(): Promise<InventoryRequest[]> {
    return repositories.inventoryRequests.getInventoryRequests(undefined, undefined, undefined);
  }

  async getPendingInventoryRequestsCount(): Promise<number> {
    const requests = await repositories.inventoryRequests.getInventoryRequests(undefined, undefined, 'pending');
    return requests.length;
  }
}

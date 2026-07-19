import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import type { IAdminDashboardRepository } from '@stockpro/contracts';
import { getDatabase } from '@core/database/connection';
import { users } from '@shared/schema';
import { getInventoryTechnicianDataPort } from '../adapters/inventory-ports.registry';

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

    const port = getInventoryTechnicianDataPort();
    const result: TechnicianWithFixedInventory[] = [];

    for (const technician of technicians) {
      const fixedInventory = await port.getFixedInventoryByTechnicianId(technician.technicianId);

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
    const totals = await getInventoryTechnicianDataPort().getFixedInventorySummaryTotals();

    return {
      totalN950: totals.totalN950,
      totalI9000s: totals.totalI9000s,
      totalI9100: totals.totalI9100,
      totalRollPaper: totals.totalRollPaper,
      totalStickers: totals.totalStickers,
      totalNewBatteries: totals.totalNewBatteries,
      totalMobilySim: totals.totalMobilySim,
      totalStcSim: totals.totalStcSim,
      totalZainSim: totals.totalZainSim,
      totalLebaraSim: totals.totalLebaraSim,
      techniciansWithCriticalStock: 0,
      techniciansWithWarningStock: 0,
      techniciansWithGoodStock: totals.technicianCount,
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

    if (technicians.length === 0) return [];

    const ids = technicians.map((tech) => tech.technicianId);
    const { fixedByTechnicianId, movingByTechnicianId } =
      await getInventoryTechnicianDataPort().getFixedAndMovingEntriesByTechnicianIds(ids);

    return technicians.map((tech) => {
      const fixedEntries = fixedByTechnicianId.get(tech.technicianId) || [];
      const movingEntries = movingByTechnicianId.get(tech.technicianId) || [];
      return {
        technicianId: tech.technicianId,
        technicianName: tech.fullName,
        city: tech.city || 'غير محدد',
        regionId: tech.regionId,
        fixedInventory: fixedEntries.length ? { entries: fixedEntries } : null,
        movingInventory: movingEntries.length ? { entries: movingEntries } : null,
        alertLevel: 'good' as const,
      };
    });
  }

  async getInventoryRequests(): Promise<InventoryRequest[]> {
    const requests = await getInventoryTechnicianDataPort().getAllInventoryRequests();

    const technicianIds = [...new Set(requests.map((r) => r.technicianId).filter(Boolean))] as string[];
    const techRows = technicianIds.length > 0
      ? await this.db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, technicianIds))
      : [];
    const nameById = new Map(techRows.map((u) => [u.id, u.fullName]));

    return requests.map((request: any) => ({
      ...request,
      technicianName: (request.technicianId && nameById.get(request.technicianId)) || 'غير معروف',
    }));
  }

  async getPendingInventoryRequestsCount(): Promise<number> {
    return getInventoryTechnicianDataPort().getPendingInventoryRequestsCount();
  }
}

import { db } from "@core/config/db";
import {
  inventoryItems,
  transactions,
  regions,
  systemLogs,
  inventoryRequests,
  warehouseTransfers,
  technicianFixedInventories,
  warehouses,
  itemTypes,
  type DashboardStats,
  type AdminStats,
  type TransactionWithDetails,
  type SystemLog,
  type InsertSystemLog,
  type RegionWithStats
} from "@shared/schema";
import { eq, desc, and, or, sql, count, gte, lte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

/**
 * System Analytics Service
 * Handles system-wide statistics, analytics, and logging
 */
export class SystemAnalyticsService {

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Get total counts
    const [itemsCount] = await db.select({ count: count() }).from(inventoryItems);
    const userStats = await getInventoryIdentityPorts().getActiveUserStats();
    const [regionsCount] = await db.select({ count: count() }).from(regions);
    const [todayTransactions] = await db
      .select({ count: count() })
      .from(transactions)
      .where(gte(transactions.createdAt, sql`DATE_TRUNC('day', NOW())`));

    // Get low stock items count
    const lowStockItems = await db
      .select({ count: count() })
      .from(inventoryItems)
      .where(sql`${inventoryItems.quantity} <= ${inventoryItems.minThreshold}`);

    const outOfStockItems = await db
      .select({ count: count() })
      .from(inventoryItems)
      .where(eq(inventoryItems.quantity, 0));

    return {
      totalItems: itemsCount.count,
      totalUsers: userStats.total,
      totalRegions: regionsCount.count,
      lowStockItems: lowStockItems[0].count,
      outOfStockItems: outOfStockItems[0].count,
      todayTransactions: todayTransactions.count,
    };
  }

  /**
   * Get admin statistics
   */
  async getAdminStats(): Promise<AdminStats> {
    const ports = getInventoryIdentityPorts();
    const [userStats, countsByRole] = await Promise.all([
      ports.getActiveUserStats(),
      ports.getUserCountsByRole(),
    ]);
    const stats = {
      totalUsers: userStats.total,
      totalActiveUsers: userStats.active,
      totalTechnicians: countsByRole["technician"] ?? 0,
      totalSupervisors: countsByRole["supervisor"] ?? 0,
      totalAdmins: countsByRole["admin"] ?? 0,
    };

    const [regionsCount] = await db.select({ count: count() }).from(regions);
    const [transactionsCount] = await db.select({ count: count() }).from(transactions);
    const recentTransactions = await this.getRecentTransactions(10);

    const [inventoryStats] = await db
      .select({
        totalInventoryItems: count(inventoryItems.id),
        totalQuantity: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)`,
        lowStockItems: sql<number>`COUNT(CASE WHEN ${inventoryItems.quantity} <= ${inventoryItems.minThreshold} THEN 1 END)`,
        outOfStockItems: sql<number>`COUNT(CASE WHEN ${inventoryItems.quantity} = 0 THEN 1 END)`
      })
      .from(inventoryItems);

    const [requestStats] = await db
      .select({
        totalRequests: count(inventoryRequests.id),
        pendingRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'pending' THEN 1 END)`,
        approvedRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'approved' THEN 1 END)`,
        rejectedRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'rejected' THEN 1 END)`
      })
      .from(inventoryRequests);

    const [transferStats] = await db
      .select({
        totalTransfers: count(warehouseTransfers.id),
        pendingTransfers: sql<number>`COUNT(CASE WHEN ${warehouseTransfers.status} = 'pending' THEN 1 END)`,
        acceptedTransfers: sql<number>`COUNT(CASE WHEN ${warehouseTransfers.status} = 'accepted' OR ${warehouseTransfers.status} = 'approved' THEN 1 END)`,
        rejectedTransfers: sql<number>`COUNT(CASE WHEN ${warehouseTransfers.status} = 'rejected' THEN 1 END)`
      })
      .from(warehouseTransfers);

    return {
      totalRegions: Number(regionsCount.count),
      totalUsers: Number(stats.totalUsers),
      activeUsers: Number(stats.totalActiveUsers),
      totalTransactions: Number(transactionsCount.count),
      recentTransactions,
    };
  }

  /**
   * Get recent transactions with details
   */
  async getRecentTransactions(limit: number = 10): Promise<TransactionWithDetails[]> {
    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        itemId: transactions.itemId,
        quantity: transactions.quantity,
        reason: transactions.reason,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);

    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(userIds as string[]);

    return rows.map((row) => ({
      ...row,
      itemName: row.itemName || undefined,
      userName: (row.userId && usersById.get(row.userId)?.fullName) || undefined,
      userRole: row.userId ? usersById.get(row.userId)?.role : undefined,
    }));
  }

  /**
   * Get regions with statistics
   */
  async getRegions(): Promise<RegionWithStats[]> {
    const [regionRows, warehouseCountRows, userCountsByRegionAndRole] = await Promise.all([
      db.select({
        id: regions.id,
        name: regions.name,
        description: regions.description,
        isActive: regions.isActive,
        createdAt: regions.createdAt,
        updatedAt: regions.updatedAt,
      }).from(regions),
      db.select({
        regionId: warehouses.regionId,
        totalWarehouses: sql<number>`COUNT(DISTINCT ${warehouses.id})`,
      }).from(warehouses).groupBy(warehouses.regionId),
      getInventoryIdentityPorts().getUserCountsByRegionAndRole(),
    ]);

    const warehouseCountByRegion = new Map(warehouseCountRows.map((r) => [r.regionId, Number(r.totalWarehouses)]));

    const usersByRegion = new Map<string, { total: number; technicians: number; supervisors: number }>();
    for (const row of userCountsByRegionAndRole) {
      if (!row.regionId) continue;
      const entry = usersByRegion.get(row.regionId) ?? { total: 0, technicians: 0, supervisors: 0 };
      entry.total += row.count;
      if (row.role === "technician") entry.technicians += row.count;
      if (row.role === "supervisor") entry.supervisors += row.count;
      usersByRegion.set(row.regionId, entry);
    }

    return regionRows.map((region) => {
      const userStats = usersByRegion.get(region.id) ?? { total: 0, technicians: 0, supervisors: 0 };
      return {
        ...region,
        totalUsers: userStats.total,
        totalWarehouses: warehouseCountByRegion.get(region.id) ?? 0,
        totalTechnicians: userStats.technicians,
        totalSupervisors: userStats.supervisors,
        itemCount: 0,
        totalQuantity: 0,
        lowStockCount: 0,
      };
    });
  }

  /**
   * Create system log entry
   */
  async createSystemLog(logData: InsertSystemLog): Promise<SystemLog> {
    const [newLog] = await db
      .insert(systemLogs)
      .values({
        ...logData,
        id: randomUUID(),
        createdAt: new Date()
      })
      .returning();

    if (!newLog) {
      throw new Error("Failed to create system log");
    }

    return newLog;
  }

  /**
   * Get system logs with filters
   */
  async getSystemLogs(filters?: {
    userId?: string;
    regionId?: string;
    action?: string;
    entityType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SystemLog[]> {
    let query = db.select().from(systemLogs).$dynamic();
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(systemLogs.userId, filters.userId));
    }
    if (filters?.regionId) {
      conditions.push(eq(systemLogs.regionId, filters.regionId));
    }
    if (filters?.action) {
      conditions.push(eq(systemLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(systemLogs.entityType, filters.entityType));
    }
    if (filters?.severity) {
      conditions.push(eq(systemLogs.severity, filters.severity));
    }
    if (filters?.startDate) {
      conditions.push(gte(systemLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(systemLogs.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(systemLogs.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return query as any;
  }

  /**
   * Get system activity summary by date range
   */
  async getActivitySummary(startDate: Date, endDate: Date) {
    const activitySummary = await db
      .select({
        date: sql<string>`DATE(${systemLogs.createdAt})`,
        totalActions: count(systemLogs.id),
        successfulActions: sql<number>`COUNT(CASE WHEN ${systemLogs.success} = true THEN 1 END)`,
        failedActions: sql<number>`COUNT(CASE WHEN ${systemLogs.success} = false THEN 1 END)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${systemLogs.userId})`
      })
      .from(systemLogs)
      .where(
        and(
          gte(systemLogs.createdAt, startDate),
          lte(systemLogs.createdAt, endDate)
        )
      )
      .groupBy(sql`DATE(${systemLogs.createdAt})`)
      .orderBy(sql`DATE(${systemLogs.createdAt})`);

    return activitySummary;
  }

  /**
   * Get inventory movements summary
   */
  async getInventoryMovementsSummary(regionId?: string) {
    let query = db
      .select({
        totalRequests: count(inventoryRequests.id),
        pendingRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'pending' THEN 1 END)`,
        approvedRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'approved' THEN 1 END)`,
        rejectedRequests: sql<number>`COUNT(CASE WHEN ${inventoryRequests.status} = 'rejected' THEN 1 END)`,
        totalTransfers: sql<number>`(SELECT COUNT(*) FROM ${warehouseTransfers})`,
        pendingTransfers: sql<number>`(SELECT COUNT(*) FROM ${warehouseTransfers} WHERE status = 'pending')`,
        acceptedTransfers: sql<number>`(SELECT COUNT(*) FROM ${warehouseTransfers} WHERE status = 'accepted')`,
        rejectedTransfers: sql<number>`(SELECT COUNT(*) FROM ${warehouseTransfers} WHERE status = 'rejected')`
      })
      .from(inventoryRequests)
      .$dynamic();

    if (regionId) {
      const technicianIdsInRegion = await getInventoryIdentityPorts().getUserIdsByRegion(regionId);
      query = query.where(
        technicianIdsInRegion.length > 0
          ? inArray(inventoryRequests.technicianId, technicianIdsInRegion as string[])
          : sql`false`
      );
    }

    const [summary] = await query;
    return summary;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    // Average response time for inventory requests
    const avgRequestResponseTime = await db
      .select({
        avgHours: sql<number>`AVG(EXTRACT(EPOCH FROM (responded_at - created_at)) / 3600)`
      })
      .from(inventoryRequests)
      .where(and(
        sql`${inventoryRequests.respondedAt} IS NOT NULL`,
        sql`${inventoryRequests.createdAt} IS NOT NULL`
      ));

    // Most active regions — grouped by systemLogs.userId only (no join), then
    // each user's regionId is resolved via the identity port and aggregated
    // in application code, since users is not owned by inventory.
    const activityByUserIdRows = await db
      .select({ userId: systemLogs.userId, activityCount: count(systemLogs.id) })
      .from(systemLogs)
      .groupBy(systemLogs.userId);

    const activityUserIds = activityByUserIdRows.map((r) => r.userId).filter(Boolean) as string[];
    const usersForActivity = await getInventoryIdentityPorts().getUsersByIds(activityUserIds);

    const activityByRegion = new Map<string, number>();
    for (const row of activityByUserIdRows) {
      const regionId = row.userId ? usersForActivity.get(row.userId)?.regionId : null;
      if (!regionId) continue;
      activityByRegion.set(regionId, (activityByRegion.get(regionId) ?? 0) + Number(row.activityCount));
    }

    const activeRegionIds = [...activityByRegion.keys()];
    const regionNameRows = activeRegionIds.length > 0
      ? await db.select({ id: regions.id, name: regions.name }).from(regions).where(inArray(regions.id, activeRegionIds))
      : [];
    const regionNameById = new Map(regionNameRows.map((r) => [r.id, r.name]));

    const mostActiveRegions = [...activityByRegion.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([regionId, activityCount]) => ({
        regionId,
        regionName: regionNameById.get(regionId),
        activityCount,
      }));

    // Top users by activity
    const topUsersByActivity = await db
      .select({
        userId: systemLogs.userId,
        userName: systemLogs.userName,
        userRole: systemLogs.userRole,
        activityCount: count(systemLogs.id)
      })
      .from(systemLogs)
      .groupBy(systemLogs.userId, systemLogs.userName, systemLogs.userRole)
      .orderBy(desc(count(systemLogs.id)))
      .limit(10);

    return {
      avgRequestResponseTime: avgRequestResponseTime[0]?.avgHours || 0,
      mostActiveRegions,
      topUsersByActivity
    };
  }

  /**
   * Get error analysis
   */
  async getErrorAnalysis(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const errorAnalysis = await db
      .select({
        date: sql<string>`DATE(${systemLogs.createdAt})`,
        severity: systemLogs.severity,
        errorCount: count(systemLogs.id),
        entityType: systemLogs.entityType,
        action: systemLogs.action
      })
      .from(systemLogs)
      .where(
        and(
          eq(systemLogs.success, false),
          gte(systemLogs.createdAt, startDate)
        )
      )
      .groupBy(
        sql`DATE(${systemLogs.createdAt})`,
        systemLogs.severity,
        systemLogs.entityType,
        systemLogs.action
      )
      .orderBy(desc(count(systemLogs.id)));

    return errorAnalysis;
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(systemLogs)
      .where(lte(systemLogs.createdAt, cutoffDate));

    return (result as any).changes || 0;
  }

  /**
   * Get public stock catalog and stats
   */
  async getPublicStock() {
    const [warehousesCount] = await db.select({ count: count() }).from(warehouses);
    const [itemTypesCount] = await db.select({ count: count() }).from(itemTypes).where(and(eq(itemTypes.isActive, true), eq(itemTypes.isVisible, true)));
    const identityPorts = getInventoryIdentityPorts();
    const [countsByRole, citiesCount] = await Promise.all([
      identityPorts.getUserCountsByRole(),
      identityPorts.getDistinctUserCityCount(),
    ]);
    const techniciansCount = { count: countsByRole["technician"] ?? 0 };

    const products = await db.select()
      .from(itemTypes)
      .where(and(eq(itemTypes.isActive, true), eq(itemTypes.isVisible, true)))
      .orderBy(itemTypes.sortOrder, itemTypes.nameAr);

    return {
      stats: {
        warehouses: warehousesCount.count,
        products: itemTypesCount.count,
        technicians: techniciansCount.count,
        cities: citiesCount || 29
      },
      products: products.map(p => ({
        id: p.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        category: p.category,
        icon: p.icon,
        color: p.color
      }))
    };
  }
}
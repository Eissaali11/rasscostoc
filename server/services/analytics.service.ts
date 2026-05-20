import { db } from "../db";
import { 
  inventoryItems,
  transactions,
  regions,
  users,
  systemLogs,
  inventoryRequests,
  warehouseTransfers,
  technicianFixedInventories,
  warehouses,
  type DashboardStats,
  type AdminStats,
  type TransactionWithDetails,
  type SystemLog,
  type InsertSystemLog,
  type RegionWithStats
} from "@shared/schema";
import { eq, desc, and, or, sql, count, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

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
    const [usersCount] = await db.select({ count: count() }).from(users);
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
      totalUsers: usersCount.count,
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
    const [stats] = await db
      .select({
        totalUsers: count(users.id),
        totalActiveUsers: sql<number>`COUNT(CASE WHEN ${users.isActive} = true THEN 1 END)`,
        totalTechnicians: sql<number>`COUNT(CASE WHEN ${users.role} = 'technician' THEN 1 END)`,
        totalSupervisors: sql<number>`COUNT(CASE WHEN ${users.role} = 'supervisor' THEN 1 END)`,
        totalAdmins: sql<number>`COUNT(CASE WHEN ${users.role} = 'admin' THEN 1 END)`
      })
      .from(users);

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
    const transactionsWithDetails = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        itemId: transactions.itemId,
        quantity: transactions.quantity,
        reason: transactions.reason,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
        userName: users.fullName,
        userRole: users.role
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);

    return transactionsWithDetails.map((row) => ({
      ...row,
      itemName: row.itemName || undefined,
      userName: row.userName || undefined,
    }));
  }

  /**
   * Get regions with statistics
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
      query = query
        .leftJoin(users, eq(inventoryRequests.technicianId, users.id))
        .where(eq(users.regionId, regionId));
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

    // Most active regions
    const mostActiveRegions = await db
      .select({
        regionId: users.regionId,
        regionName: regions.name,
        activityCount: count(systemLogs.id)
      })
      .from(systemLogs)
      .leftJoin(users, eq(systemLogs.userId, users.id))
      .leftJoin(regions, eq(users.regionId, regions.id))
      .groupBy(users.regionId, regions.name)
      .orderBy(desc(count(systemLogs.id)))
      .limit(5);

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
}
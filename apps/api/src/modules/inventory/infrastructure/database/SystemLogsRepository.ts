import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { ISystemLogsRepository, SystemLogsFilters } from '../../application/system-logs/contracts/ISystemLogsRepository';
import { getDatabase } from "@core/database/connection";
import { systemLogs, type InsertSystemLog, type SystemLog } from "@shared/schema";

export class SystemLogsRepository implements ISystemLogsRepository {
  private get db() {
    return getDatabase();
  }

  async getSystemLogs(filters?: SystemLogsFilters): Promise<SystemLog[]> {
    let query = this.db.select().from(systemLogs).$dynamic();

    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(systemLogs.userId, filters.userId));
    if (filters?.regionId) conditions.push(eq(systemLogs.regionId, filters.regionId));
    if (filters?.action) conditions.push(eq(systemLogs.action, filters.action));
    if (filters?.entityType) conditions.push(eq(systemLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(systemLogs.entityId, filters.entityId));
    if (filters?.severity) conditions.push(eq(systemLogs.severity, filters.severity));
    if (filters?.startDate) conditions.push(gte(systemLogs.createdAt, new Date(filters.startDate)));
    if (filters?.endDate) conditions.push(lte(systemLogs.createdAt, new Date(filters.endDate)));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.offset(filters.offset);

    return query.orderBy(desc(systemLogs.createdAt));
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await this.db.insert(systemLogs).values(log).returning();
    return created;
  }
}

import type { TransactionWithDetails } from '@shared/schema';
import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import type {
  ITransactionsReadRepository,
  TransactionStatisticsFilters,
  TransactionStatisticsResult,
  TransactionsListFilters,
  TransactionsListResult,
} from "@modules/inventory/application/transactions/contracts/ITransactionsReadRepository";
import { getDatabase } from "@core/database/connection";
import { inventoryItems, regions, transactions, users } from "@shared/schema";

export class DrizzleTransactionsReadRepository implements ITransactionsReadRepository {
  private get db() {
    return getDatabase();
  }

  async getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]> {
    const recentTransactions = await this.db
      .select({
        id: transactions.id,
        itemId: transactions.itemId,
        type: transactions.type,
        quantity: transactions.quantity,
        reason: transactions.reason,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
        userName: users.fullName,
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit || 10);

    return recentTransactions.map((transaction) => ({
      ...transaction,
      itemName: transaction.itemName || undefined,
      userName: transaction.userName || undefined,
    }));
  }

  async getTransactions(filters?: TransactionsListFilters): Promise<TransactionsListResult> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    const query = this.db
      .select({
        id: transactions.id,
        itemId: transactions.itemId,
        userId: transactions.userId,
        type: transactions.type,
        quantity: transactions.quantity,
        reason: transactions.reason,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
        userName: users.fullName,
        regionName: regions.name,
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id))
      .$dynamic();

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id))
      .$dynamic();

    const conditions: any[] = [];

    if (filters?.type) conditions.push(eq(transactions.type, filters.type));
    if (filters?.userId) conditions.push(eq(transactions.userId, filters.userId));
    if (filters?.regionId) conditions.push(eq(inventoryItems.regionId, filters.regionId));
    if (filters?.startDate) conditions.push(gte(transactions.createdAt, new Date(filters.startDate)));
    if (filters?.endDate) conditions.push(lte(transactions.createdAt, new Date(filters.endDate)));
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(inventoryItems.name, searchTerm),
          ilike(users.fullName, searchTerm),
          ilike(transactions.reason, searchTerm),
        ),
      );
    }

    let finalQuery = query;
    let finalCountQuery = countQuery;
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      finalQuery = query.where(whereCondition);
      finalCountQuery = countQuery.where(whereCondition);
    }

    const [{ count }] = await finalCountQuery;
    const total = Number(count || 0);

    const rows = await finalQuery
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    const processedTransactions = rows.map((transaction) => ({
      ...transaction,
      itemName: transaction.itemName || 'صنف محذوف',
      userName: transaction.userName || 'غير محدد',
      regionName: transaction.regionName || 'غير محدد',
    }));

    return {
      transactions: processedTransactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactionStatistics(filters?: TransactionStatisticsFilters): Promise<TransactionStatisticsResult> {
    const conditions: any[] = [];

    if (filters?.regionId) {
      conditions.push(eq(users.regionId, filters.regionId));
    }

    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      if (!Number.isNaN(startDate.getTime())) {
        conditions.push(gte(transactions.createdAt, startDate));
      }
    }

    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(transactions.createdAt, endDate));
      }
    }

    let totalsQuery = this.db
      .select({
        totalTransactions: sql<number>`COUNT(*)`,
        totalAdditions: sql<number>`COUNT(CASE WHEN ${transactions.type} IN ('add', 'inbound') THEN 1 END)`,
        totalWithdrawals: sql<number>`COUNT(CASE WHEN ${transactions.type} IN ('withdraw', 'outbound') THEN 1 END)`,
        totalAddedQuantity: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} IN ('add', 'inbound') THEN ${transactions.quantity} ELSE 0 END), 0)`,
        totalWithdrawnQuantity: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} IN ('withdraw', 'outbound') THEN ${transactions.quantity} ELSE 0 END), 0)`,
        totalAdjustment: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'adjustment' THEN 1 END)`,
        totalTransfer: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'transfer' THEN 1 END)`,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .$dynamic();

    if (conditions.length > 0) {
      totalsQuery = totalsQuery.where(and(...conditions));
    }

    const [totals] = await totalsQuery;

    let byRegionQuery = this.db
      .select({
        regionName: sql<string>`COALESCE(${regions.name}, 'غير محدد')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .leftJoin(regions, eq(users.regionId, regions.id))
      .$dynamic();

    if (conditions.length > 0) {
      byRegionQuery = byRegionQuery.where(and(...conditions));
    }

    const byRegionRows = await byRegionQuery
      .groupBy(regions.id, regions.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    let byUserQuery = this.db
      .select({
        userName: sql<string>`COALESCE(${users.fullName}, 'غير محدد')`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .$dynamic();

    if (conditions.length > 0) {
      byUserQuery = byUserQuery.where(and(...conditions));
    }

    const byUserRows = await byUserQuery
      .groupBy(users.id, users.fullName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    const totalAdditions = Number(totals?.totalAdditions || 0);
    const totalWithdrawals = Number(totals?.totalWithdrawals || 0);

    return {
      totalTransactions: Number(totals?.totalTransactions || 0),
      totalAdditions,
      totalWithdrawals,
      totalAddedQuantity: Number(totals?.totalAddedQuantity || 0),
      totalWithdrawnQuantity: Number(totals?.totalWithdrawnQuantity || 0),
      byRegion: byRegionRows.map((row) => ({
        regionName: row.regionName || 'غير محدد',
        count: Number(row.count || 0),
      })),
      byUser: byUserRows.map((row) => ({
        userName: row.userName || 'غير محدد',
        count: Number(row.count || 0),
      })),
      totalInbound: totalAdditions,
      totalOutbound: totalWithdrawals,
      totalAdjustment: Number(totals?.totalAdjustment || 0),
      totalTransfer: Number(totals?.totalTransfer || 0),
    };
  }
}

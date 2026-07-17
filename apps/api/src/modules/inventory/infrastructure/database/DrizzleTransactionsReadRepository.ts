import type { TransactionWithDetails } from '@shared/schema';
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import type {
  ITransactionsReadRepository,
  TransactionStatisticsFilters,
  TransactionStatisticsResult,
  TransactionsListFilters,
  TransactionsListResult,
} from "@modules/inventory/application/transactions/contracts/ITransactionsReadRepository";
import { getDatabase } from "@core/database/connection";
import { inventoryItems, regions, transactions } from "@shared/schema";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

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
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .orderBy(desc(transactions.createdAt))
      .limit(limit || 10);

    const userIds = [...new Set(recentTransactions.map((t) => t.userId).filter(Boolean))];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(userIds as string[]);

    return recentTransactions.map((transaction) => ({
      ...transaction,
      itemName: transaction.itemName || undefined,
      userName: (transaction.userId && usersById.get(transaction.userId)?.fullName) || undefined,
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
        regionName: regions.name,
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(regions, eq(inventoryItems.regionId, regions.id))
      .$dynamic();

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
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
      const matchingUserIds = await getInventoryIdentityPorts().searchUserIdsByName(filters.search);
      const searchConditions = [
        ilike(inventoryItems.name, searchTerm),
        ilike(transactions.reason, searchTerm),
      ];
      if (matchingUserIds.length > 0) {
        searchConditions.push(inArray(transactions.userId, matchingUserIds as string[]));
      }
      conditions.push(or(...searchConditions));
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

    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    const usersById = await getInventoryIdentityPorts().getUsersByIds(userIds as string[]);

    const processedTransactions = rows.map((transaction) => ({
      ...transaction,
      itemName: transaction.itemName || 'صنف محذوف',
      userName: (transaction.userId && usersById.get(transaction.userId)?.fullName) || 'غير محدد',
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
      const userIdsInRegion = await getInventoryIdentityPorts().getUserIdsByRegion(filters.regionId);
      conditions.push(
        userIdsInRegion.length > 0
          ? inArray(transactions.userId, userIdsInRegion as string[])
          : sql`false`
      );
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
      .$dynamic();

    if (conditions.length > 0) {
      totalsQuery = totalsQuery.where(and(...conditions));
    }

    const [totals] = await totalsQuery;

    // Grouped by transactions.userId only — no join. Used to build both
    // byUser (top 10 individual users) and byRegion (aggregated via each
    // user's regionId, resolved through the identity port) below.
    let byUserIdQuery = this.db
      .select({
        userId: transactions.userId,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .$dynamic();

    if (conditions.length > 0) {
      byUserIdQuery = byUserIdQuery.where(and(...conditions));
    }

    const byUserIdRows = await byUserIdQuery.groupBy(transactions.userId);

    const identityPorts = getInventoryIdentityPorts();
    const allUserIds = byUserIdRows.map((r) => r.userId).filter(Boolean) as string[];
    const usersById = await identityPorts.getUsersByIds(allUserIds);

    const byUserRows = [...byUserIdRows]
      .sort((a, b) => Number(b.count) - Number(a.count))
      .slice(0, 10);

    const regionCounts = new Map<string, number>();
    for (const row of byUserIdRows) {
      const regionId = row.userId ? usersById.get(row.userId)?.regionId : null;
      const key = regionId ?? '__none__';
      regionCounts.set(key, (regionCounts.get(key) ?? 0) + Number(row.count));
    }

    const regionIds = [...regionCounts.keys()].filter((k) => k !== '__none__');
    const regionRows = regionIds.length > 0
      ? await this.db.select({ id: regions.id, name: regions.name }).from(regions).where(inArray(regions.id, regionIds))
      : [];
    const regionNameById = new Map(regionRows.map((r) => [r.id, r.name]));

    const byRegionRows = [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([regionId, count]) => ({
        regionName: (regionId !== '__none__' ? regionNameById.get(regionId) : undefined) || 'غير محدد',
        count,
      }));

    const totalAdditions = Number(totals?.totalAdditions || 0);
    const totalWithdrawals = Number(totals?.totalWithdrawals || 0);

    return {
      totalTransactions: Number(totals?.totalTransactions || 0),
      totalAdditions,
      totalWithdrawals,
      totalAddedQuantity: Number(totals?.totalAddedQuantity || 0),
      totalWithdrawnQuantity: Number(totals?.totalWithdrawnQuantity || 0),
      byRegion: byRegionRows,
      byUser: byUserRows.map((row) => ({
        userName: (row.userId && usersById.get(row.userId)?.fullName) || 'غير محدد',
        count: Number(row.count || 0),
      })),
      totalInbound: totalAdditions,
      totalOutbound: totalWithdrawals,
      totalAdjustment: Number(totals?.totalAdjustment || 0),
      totalTransfer: Number(totals?.totalTransfer || 0),
    };
  }
}

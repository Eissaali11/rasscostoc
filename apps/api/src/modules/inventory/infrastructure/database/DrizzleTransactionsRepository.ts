import { and, eq, desc, sql, gte, lte, count } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import {
  transactions,
  inventoryItems,
  users,
  type Transaction,
  type InsertTransaction,
  type TransactionWithDetails
} from "@shared/schema";
import type { ITransactionsRepository } from "@modules/inventory/application/transactions/contracts/ITransactionsRepository";

export class DrizzleTransactionsRepository implements ITransactionsRepository {
  private get db() {
    return getDatabase();
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await this.db
      .insert(transactions)
      .values({
        ...insertTransaction,
        createdAt: new Date()
      })
      .returning();

    if (!newTransaction) {
      throw new Error("Failed to create transaction");
    }

    return newTransaction;
  }

  async getTransactions(filters?: {
    userId?: string;
    itemId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<TransactionWithDetails[]> {
    let query = this.db
      .select({
        id: transactions.id,
        type: transactions.type,
        itemId: transactions.itemId,
        quantity: transactions.quantity,
        reason: transactions.reason,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
        itemType: inventoryItems.type,
        userName: users.fullName,
        userRole: users.role,
        userCity: users.city
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .$dynamic();

    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(transactions.userId, filters.userId));
    }
    if (filters?.itemId) {
      conditions.push(eq(transactions.itemId, filters.itemId));
    }
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters?.startDate) {
      conditions.push(gte(transactions.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transactions.createdAt, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(transactions.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const rows = await query;
    return rows.map((row) => ({
      ...row,
      itemName: row.itemName || undefined,
      userName: row.userName || undefined,
    }));
  }

  async getTransactionStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    let query = this.db
      .select({
        totalTransactions: count(transactions.id),
        totalInbound: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'inbound' THEN 1 END)`,
        totalOutbound: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'outbound' THEN 1 END)`,
        totalAdjustment: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'adjustment' THEN 1 END)`,
        totalTransfer: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'transfer' THEN 1 END)`,
        totalQuantityInbound: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'inbound' THEN ${transactions.quantity} END), 0)`,
        totalQuantityOutbound: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'outbound' THEN ${transactions.quantity} END), 0)`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${transactions.userId})`,
        uniqueItems: sql<number>`COUNT(DISTINCT ${transactions.itemId})`
      })
      .from(transactions)
      .$dynamic();

    const conditions = [];
    if (startDate) {
      conditions.push(gte(transactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [stats] = await query;
    return stats;
  }

  async getDailyTransactionSummary(startDate: Date, endDate: Date): Promise<any[]> {
    return this.db
      .select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        totalTransactions: count(transactions.id),
        inboundCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'inbound' THEN 1 END)`,
        outboundCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'outbound' THEN 1 END)`,
        adjustmentCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'adjustment' THEN 1 END)`,
        transferCount: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'transfer' THEN 1 END)`,
        totalQuantityInbound: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'inbound' THEN ${transactions.quantity} END), 0)`,
        totalQuantityOutbound: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'outbound' THEN ${transactions.quantity} END), 0)`
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.createdAt, startDate),
          lte(transactions.createdAt, endDate)
        )
      )
      .groupBy(sql`DATE(${transactions.createdAt})`)
      .orderBy(sql`DATE(${transactions.createdAt})`);
  }

  async getMostActiveUsers(limit: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = this.db
      .select({
        userId: transactions.userId,
        userName: users.fullName,
        userRole: users.role,
        userCity: users.city,
        transactionCount: count(transactions.id),
        totalQuantityHandled: sql<number>`SUM(${transactions.quantity})`,
        inboundTransactions: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'inbound' THEN 1 END)`,
        outboundTransactions: sql<number>`COUNT(CASE WHEN ${transactions.type} = 'outbound' THEN 1 END)`
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.userId, users.id))
      .$dynamic();

    const conditions = [];
    if (startDate) {
      conditions.push(gte(transactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query
      .groupBy(transactions.userId, users.fullName, users.role, users.city)
      .orderBy(desc(count(transactions.id)))
      .limit(limit);
  }

  async getMostTransactedItems(limit: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = this.db
      .select({
        itemId: transactions.itemId,
        itemName: inventoryItems.name,
        itemType: inventoryItems.type,
        transactionCount: count(transactions.id),
        totalQuantityTransacted: sql<number>`SUM(${transactions.quantity})`,
        inboundQuantity: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'inbound' THEN ${transactions.quantity} END), 0)`,
        outboundQuantity: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'outbound' THEN ${transactions.quantity} END), 0)`,
        currentStock: inventoryItems.quantity
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .$dynamic();

    const conditions = [];
    if (startDate) {
      conditions.push(gte(transactions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.createdAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query
      .groupBy(
        transactions.itemId, 
        inventoryItems.name, 
        inventoryItems.type, 
        inventoryItems.quantity
      )
      .orderBy(desc(count(transactions.id)))
      .limit(limit);
  }

  async getTransactionTrends(days: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.db
      .select({
        date: sql<string>`DATE(${transactions.createdAt})`,
        hour: sql<number>`EXTRACT(hour FROM ${transactions.createdAt})`,
        transactionCount: count(transactions.id)
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .groupBy(
        sql`DATE(${transactions.createdAt})`,
        sql`EXTRACT(hour FROM ${transactions.createdAt})`
      )
      .orderBy(
        sql`DATE(${transactions.createdAt})`,
        sql`EXTRACT(hour FROM ${transactions.createdAt})`
      );
  }

  async getTransactionsWithPagination(
    page: number,
    pageSize: number,
    filters?: {
      userId?: string;
      itemId?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(transactions.userId, filters.userId));
    }
    if (filters?.itemId) {
      conditions.push(eq(transactions.itemId, filters.itemId));
    }
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters?.startDate) {
      conditions.push(gte(transactions.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transactions.createdAt, filters.endDate));
    }

    let countQuery = this.db.select({ count: count() }).from(transactions).$dynamic();
    let dataQuery = this.db
      .select({
        id: transactions.id,
        type: transactions.type,
        itemId: transactions.itemId,
        quantity: transactions.quantity,
        reason: transactions.reason,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
        itemName: inventoryItems.name,
        itemType: inventoryItems.type,
        userName: users.fullName,
        userRole: users.role,
        userCity: users.city
      })
      .from(transactions)
      .leftJoin(inventoryItems, eq(transactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(transactions.userId, users.id))
      .$dynamic();

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      countQuery = countQuery.where(whereClause);
      dataQuery = dataQuery.where(whereClause);
    }

    const [totalCount] = await countQuery;
    const transactionsData = await dataQuery
      .orderBy(desc(transactions.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data: transactionsData,
      pagination: {
        page,
        pageSize,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / pageSize)
      }
    };
  }
}

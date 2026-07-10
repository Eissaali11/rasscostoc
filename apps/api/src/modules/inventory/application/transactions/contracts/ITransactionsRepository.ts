import type {
  Transaction,
  InsertTransaction,
  TransactionWithDetails
} from "@shared/schema";

export interface ITransactionsRepository {
  createTransaction(insertTransaction: InsertTransaction): Promise<Transaction>;
  getTransactions(filters?: {
    userId?: string;
    itemId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<TransactionWithDetails[]>;
  getTransactionStatistics(startDate?: Date, endDate?: Date): Promise<any>;
  getDailyTransactionSummary(startDate: Date, endDate: Date): Promise<any[]>;
  getMostActiveUsers(limit: number, startDate?: Date, endDate?: Date): Promise<any[]>;
  getMostTransactedItems(limit: number, startDate?: Date, endDate?: Date): Promise<any[]>;
  getTransactionTrends(days: number): Promise<any[]>;
  getTransactionsWithPagination(
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
  }>;
}

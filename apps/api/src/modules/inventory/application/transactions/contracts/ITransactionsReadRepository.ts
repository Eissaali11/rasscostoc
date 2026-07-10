import type { TransactionWithDetails } from '@shared/schema';

export type TransactionsListFilters = {
  page?: number;
  limit?: number;
  type?: string;
  userId?: string;
  regionId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type TransactionsListResult = {
  transactions: TransactionWithDetails[];
  total: number;
  page: number;
  totalPages: number;
};

export type TransactionStatisticsFilters = {
  startDate?: string;
  endDate?: string;
  regionId?: string;
};

export type TransactionStatisticsResult = {
  totalTransactions: number;
  totalAdditions: number;
  totalWithdrawals: number;
  totalAddedQuantity: number;
  totalWithdrawnQuantity: number;
  byRegion: Array<{ regionName: string; count: number }>;
  byUser: Array<{ userName: string; count: number }>;
  totalInbound: number;
  totalOutbound: number;
  totalAdjustment: number;
  totalTransfer: number;
};

export interface ITransactionsReadRepository {
  getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]>;
  getTransactions(filters?: TransactionsListFilters): Promise<TransactionsListResult>;
  getTransactionStatistics(filters?: TransactionStatisticsFilters): Promise<TransactionStatisticsResult>;
}

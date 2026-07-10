import type { TransactionWithDetails } from '@shared/schema';
import type {
  ITransactionsReadRepository,
  TransactionStatisticsResult,
  TransactionsListResult,
} from '../contracts/ITransactionsReadRepository';

export type GetTransactionsInput = {
  page?: number;
  limit?: number;
  type?: string;
  userId?: string;
  regionId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  recent?: string;
};

function removeUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] !== undefined) {
      result[key] = value[key];
    }
  }

  return result;
}

export class GetTransactionsUseCase {
  constructor(private readonly repository: ITransactionsReadRepository) {}

  async execute(input: GetTransactionsInput): Promise<TransactionsListResult | TransactionWithDetails[]> {
    if (input.recent === 'true') {
      return this.repository.getRecentTransactions(input.limit || 10);
    }

    const filters = removeUndefinedFields({
      page: input.page,
      limit: input.limit,
      type: input.type,
      userId: input.userId,
      regionId: input.regionId,
      startDate: input.startDate,
      endDate: input.endDate,
      search: input.search,
    });

    return this.repository.getTransactions(filters);
  }
}

export type GetTransactionStatisticsInput = {
  startDate?: string;
  endDate?: string;
  regionId?: string;
};

export class GetTransactionStatisticsUseCase {
  constructor(private readonly repository: ITransactionsReadRepository) {}

  async execute(input: GetTransactionStatisticsInput): Promise<TransactionStatisticsResult> {
    const filters = removeUndefinedFields({
      startDate: input.startDate,
      endDate: input.endDate,
      regionId: input.regionId,
    });

    return this.repository.getTransactionStatistics(filters);
  }
}

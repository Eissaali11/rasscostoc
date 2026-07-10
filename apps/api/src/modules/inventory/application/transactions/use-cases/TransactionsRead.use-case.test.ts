import { describe, expect, it } from 'vitest';
import type { TransactionWithDetails } from '@shared/schema';
import type {
  ITransactionsReadRepository,
  TransactionStatisticsResult,
  TransactionsListResult,
} from '../contracts/ITransactionsReadRepository';
import {
  GetTransactionsUseCase,
  GetTransactionStatisticsUseCase,
} from './TransactionsRead.use-case';

function transactionFixture(overrides: Partial<TransactionWithDetails> = {}): TransactionWithDetails {
  return {
    id: 'tx-1',
    itemId: 'item-1',
    userId: 'user-1',
    type: 'add',
    quantity: 1,
    reason: null,
    createdAt: new Date(),
    itemName: 'Item',
    userName: 'User',
    regionName: 'Region',
    ...overrides,
  };
}

function transactionsListFixture(overrides: Partial<TransactionsListResult> = {}): TransactionsListResult {
  return {
    transactions: [transactionFixture()],
    total: 1,
    page: 1,
    totalPages: 1,
    ...overrides,
  };
}

function statisticsFixture(overrides: Partial<TransactionStatisticsResult> = {}): TransactionStatisticsResult {
  return {
    totalTransactions: 1,
    totalAdditions: 1,
    totalWithdrawals: 0,
    totalAddedQuantity: 1,
    totalWithdrawnQuantity: 0,
    byRegion: [{ regionName: 'Region', count: 1 }],
    byUser: [{ userName: 'User', count: 1 }],
    totalInbound: 1,
    totalOutbound: 0,
    totalAdjustment: 0,
    totalTransfer: 0,
    ...overrides,
  };
}

class InMemoryTransactionsReadRepository implements ITransactionsReadRepository {
  recentLimitCalls: Array<number | undefined> = [];
  listFiltersCalls: any[] = [];
  statisticsFiltersCalls: any[] = [];

  constructor(
    private readonly recentTransactions: TransactionWithDetails[] = [transactionFixture()],
    private readonly listResult: TransactionsListResult = transactionsListFixture(),
    private readonly statistics: TransactionStatisticsResult = statisticsFixture()
  ) {}

  async getRecentTransactions(limit?: number): Promise<TransactionWithDetails[]> {
    this.recentLimitCalls.push(limit);
    return this.recentTransactions;
  }

  async getTransactions(filters?: any): Promise<TransactionsListResult> {
    this.listFiltersCalls.push(filters || {});
    return this.listResult;
  }

  async getTransactionStatistics(filters?: any): Promise<TransactionStatisticsResult> {
    this.statisticsFiltersCalls.push(filters || {});
    return this.statistics;
  }
}

describe('Transactions read use cases', () => {
  it('returns recent transactions when recent flag is true', async () => {
    const repository = new InMemoryTransactionsReadRepository([
      transactionFixture({ id: 'recent-1' }),
      transactionFixture({ id: 'recent-2' }),
    ]);
    const useCase = new GetTransactionsUseCase(repository);

    const result = await useCase.execute({ recent: 'true', limit: 7 });

    expect(result).toHaveLength(2);
    expect(repository.recentLimitCalls).toEqual([7]);
    expect(repository.listFiltersCalls).toHaveLength(0);
  });

  it('returns paginated transactions and strips undefined filters', async () => {
    const repository = new InMemoryTransactionsReadRepository();
    const useCase = new GetTransactionsUseCase(repository);

    const result = await useCase.execute({
      page: 2,
      type: 'withdraw',
      userId: 'user-1',
      search: undefined,
      recent: 'false',
    });

    expect((result as TransactionsListResult).page).toBe(1);
    expect(repository.listFiltersCalls).toEqual([
      {
        page: 2,
        type: 'withdraw',
        userId: 'user-1',
      },
    ]);
  });

  it('returns transaction statistics and strips undefined filters', async () => {
    const repository = new InMemoryTransactionsReadRepository();
    const useCase = new GetTransactionStatisticsUseCase(repository);

    const result = await useCase.execute({
      startDate: '2026-01-01',
      endDate: undefined,
      regionId: 'region-1',
    });

    expect(result.totalTransactions).toBe(1);
    expect(repository.statisticsFiltersCalls).toEqual([
      {
        startDate: '2026-01-01',
        regionId: 'region-1',
      },
    ]);
  });
});

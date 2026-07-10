import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionsService } from './transactions.service';
import type { ITransactionsRepository } from './transactions/contracts/ITransactionsRepository';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockRepository: ITransactionsRepository;

  beforeEach(() => {
    mockRepository = {
      createTransaction: vi.fn(),
      getTransactions: vi.fn(),
      getTransactionStatistics: vi.fn(),
      getDailyTransactionSummary: vi.fn(),
      getMostActiveUsers: vi.fn(),
      getMostTransactedItems: vi.fn(),
      getTransactionTrends: vi.fn(),
      getTransactionsWithPagination: vi.fn(),
    };
    service = new TransactionsService(mockRepository);
  });

  it('should delegate createTransaction to repository', async () => {
    const mockTx = { id: 'tx-1', type: 'inbound', itemId: 'item-1', userId: 'user-1', quantity: 5 } as any;
    vi.mocked(mockRepository.createTransaction).mockResolvedValue(mockTx);

    const result = await service.createTransaction({ type: 'inbound', itemId: 'item-1', userId: 'user-1', quantity: 5 });
    expect(mockRepository.createTransaction).toHaveBeenCalledWith({ type: 'inbound', itemId: 'item-1', userId: 'user-1', quantity: 5 });
    expect(result).toBe(mockTx);
  });

  it('should delegate getTransactions to repository', async () => {
    const mockTxs = [{ id: 'tx-1' }] as any[];
    vi.mocked(mockRepository.getTransactions).mockResolvedValue(mockTxs);

    const result = await service.getTransactions({ userId: 'user-1' });
    expect(mockRepository.getTransactions).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toBe(mockTxs);
  });

  it('should delegate recordInventoryAdjustment to createTransaction', async () => {
    const mockTx = { id: 'tx-1' } as any;
    vi.mocked(mockRepository.createTransaction).mockResolvedValue(mockTx);

    const result = await service.recordInventoryAdjustment('item-1', 'user-1', 10, 'Adjustment note');
    expect(mockRepository.createTransaction).toHaveBeenCalledWith({
      type: 'adjustment',
      itemId: 'item-1',
      userId: 'user-1',
      quantity: 10,
      reason: 'Adjustment note',
    });
    expect(result).toBe(mockTx);
  });
});

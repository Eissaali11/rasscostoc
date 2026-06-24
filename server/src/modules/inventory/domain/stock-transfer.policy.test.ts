import { describe, expect, it } from 'vitest';
import {
  assertValidStockTransfer,
  calculateStockTransferBalances,
  SameInventoryTransferError,
} from './stock-transfer.policy';
import { InsufficientStockError } from './inventory-item.aggregate';

describe('stock transfer domain policy', () => {
  it('rejects transfer when source and destination are the same', () => {
    expect(() =>
      assertValidStockTransfer({
        quantity: 1,
        fromInventory: 'fixed',
        toInventory: 'fixed',
      })
    ).toThrowError(SameInventoryTransferError);
  });

  it('calculates box transfer balances correctly', () => {
    const result = calculateStockTransferBalances({
      source: { boxes: 10, units: 7 },
      destination: { boxes: 2, units: 1 },
      packagingType: 'box',
      quantity: 3,
    });

    expect(result.nextSource).toEqual({ boxes: 7, units: 7 });
    expect(result.nextDestination).toEqual({ boxes: 5, units: 1 });
  });

  it('calculates unit transfer balances correctly', () => {
    const result = calculateStockTransferBalances({
      source: { boxes: 4, units: 9 },
      destination: { boxes: 1, units: 2 },
      packagingType: 'unit',
      quantity: 5,
    });

    expect(result.nextSource).toEqual({ boxes: 4, units: 4 });
    expect(result.nextDestination).toEqual({ boxes: 1, units: 7 });
  });

  it('throws when source balance is insufficient', () => {
    expect(() =>
      calculateStockTransferBalances({
        source: { boxes: 1, units: 0 },
        destination: { boxes: 0, units: 0 },
        packagingType: 'box',
        quantity: 2,
      })
    ).toThrowError(InsufficientStockError);
  });
});

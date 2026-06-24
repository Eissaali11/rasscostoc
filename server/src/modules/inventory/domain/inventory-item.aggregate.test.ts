import { describe, expect, it } from 'vitest';
import {
  InsufficientStockError,
  InvalidStockQuantityError,
  InventoryItemAggregate,
} from './inventory-item.aggregate';

describe('InventoryItemAggregate', () => {
  it('adds stock successfully', () => {
    const aggregate = InventoryItemAggregate.fromCurrentQuantity(10);

    expect(aggregate.add(5)).toBe(15);
  });

  it('withdraws stock successfully', () => {
    const aggregate = InventoryItemAggregate.fromCurrentQuantity(10);

    expect(aggregate.withdraw(4)).toBe(6);
  });

  it('throws when withdrawing more than available', () => {
    const aggregate = InventoryItemAggregate.fromCurrentQuantity(3);

    expect(() => aggregate.withdraw(5)).toThrowError(InsufficientStockError);
    expect(() => aggregate.withdraw(5)).toThrowError('Insufficient stock. Available: 3, Requested: 5');
  });

  it('throws on invalid operation quantity', () => {
    const aggregate = InventoryItemAggregate.fromCurrentQuantity(10);

    expect(() => aggregate.add(0)).toThrowError(InvalidStockQuantityError);
    expect(() => aggregate.withdraw(-1)).toThrowError(InvalidStockQuantityError);
  });
});

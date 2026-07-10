import { describe, expect, it } from 'vitest';
import {
  assertValidWarehouseBatchAcceptance,
  WarehouseBatchValidationError,
} from './warehouse-batch-acceptance.policy';

describe('warehouse batch acceptance policy', () => {
  it('rejects empty transfer id arrays', () => {
    expect(() =>
      assertValidWarehouseBatchAcceptance({
        transferIds: [],
        transfers: [],
      })
    ).toThrowError(WarehouseBatchValidationError);
  });

  it('rejects mismatched ids/transfers count', () => {
    expect(() =>
      assertValidWarehouseBatchAcceptance({
        transferIds: ['t1', 't2'],
        transfers: [
          {
            id: 't1',
            warehouseId: 'w1',
            technicianId: 'tech1',
            itemType: 'n950',
            packagingType: 'box',
            quantity: 1,
            status: 'pending',
            performedBy: 'admin',
            notes: null,
          },
        ],
      })
    ).toThrowError(WarehouseBatchValidationError);
  });

  it('rejects non-pending transfers', () => {
    expect(() =>
      assertValidWarehouseBatchAcceptance({
        transferIds: ['t1'],
        transfers: [
          {
            id: 't1',
            warehouseId: 'w1',
            technicianId: 'tech1',
            itemType: 'n950',
            packagingType: 'box',
            quantity: 1,
            status: 'approved',
            performedBy: 'admin',
            notes: null,
          },
        ],
      })
    ).toThrowError(WarehouseBatchValidationError);
  });
});

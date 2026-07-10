import type { StockMovement } from '@shared/schema';
import type { TransferInventoryType } from './ITechnicianInventoryTransferRepository';

import { TransferPackagingType } from '../../../domain/stock-transfer.types';
export { TransferPackagingType };

export type CreateStockMovementInput = {
  technicianId: string;
  itemType: string;
  packagingType: TransferPackagingType;
  quantity: number;
  fromInventory: TransferInventoryType;
  toInventory: TransferInventoryType;
  performedBy: string;
  reason?: string;
  notes?: string;
};

export interface IStockMovementRepository {
  create(input: CreateStockMovementInput): Promise<StockMovement>;
  createMany(inputs: CreateStockMovementInput[]): Promise<StockMovement[]>;
}

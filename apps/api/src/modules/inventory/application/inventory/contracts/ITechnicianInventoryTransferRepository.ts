import type { TechnicianFixedInventory } from '@shared/schema';

import { TechnicianInventoryBalance } from '../../../domain/stock-transfer.types';
export { TechnicianInventoryBalance };

export type TransferInventoryType = 'fixed' | 'moving';

export interface ITechnicianInventoryTransferRepository {
  getBalance(
    technicianId: string,
    itemTypeId: string,
    inventory: TransferInventoryType
  ): Promise<TechnicianInventoryBalance>;
  setBalance(
    technicianId: string,
    itemTypeId: string,
    inventory: TransferInventoryType,
    balance: TechnicianInventoryBalance
  ): Promise<void>;
  ensureTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory>;
}

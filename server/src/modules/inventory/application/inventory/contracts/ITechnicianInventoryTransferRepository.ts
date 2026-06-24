import type { TechnicianFixedInventory } from '@shared/schema';

export type TransferInventoryType = 'fixed' | 'moving';

export type TechnicianInventoryBalance = {
  boxes: number;
  units: number;
};

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

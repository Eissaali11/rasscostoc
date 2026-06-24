import type { WarehouseTransfer } from '@shared/schema';

export type WarehouseTransferRecord = {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
  status: string;
  performedBy: string;
  notes?: string | null;
};

export type WarehouseTransferBatchCriteria = {
  warehouseId?: string;
  technicianId?: string;
  regionId?: string;
  limit?: number;
};

export type WarehouseStockBalance = {
  boxes: number;
  units: number;
  source: 'entries' | 'legacy';
};

export type TechnicianMovingStockBalance = {
  boxes: number;
  units: number;
};

export interface IWarehouseTransferBatchRepository {
  findPendingTransferIdsByCriteria(criteria?: WarehouseTransferBatchCriteria): Promise<string[]>;
  getTransfersByIds(transferIds: string[]): Promise<WarehouseTransferRecord[]>;
  findLatestTransferIdByRequestId?(requestId: string): Promise<string | undefined>;
  getWarehouseBalance(warehouseId: string, itemTypeId: string): Promise<WarehouseStockBalance>;
  setWarehouseBalance(warehouseId: string, itemTypeId: string, balance: WarehouseStockBalance): Promise<void>;
  getTechnicianMovingBalance(technicianId: string, itemTypeId: string): Promise<TechnicianMovingStockBalance>;
  setTechnicianMovingBalance(
    technicianId: string,
    itemTypeId: string,
    balance: TechnicianMovingStockBalance
  ): Promise<void>;
  markTransfersApproved(transferIds: string[]): Promise<WarehouseTransfer[]>;
  markTransfersRejected?(transferIds: string[], reason: string): Promise<WarehouseTransfer[]>;
}

import type { WarehouseTransfer, WarehouseTransferWithDetails } from '@shared/schema';

export type WarehouseTransferOperationItem = {
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
};

export type CreateWarehouseTransferOperationInput = {
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
  performedBy: string;
  notes?: string;
};

export type WarehouseTransferQueryFilters = {
  warehouseId?: string;
  technicianId?: string;
  regionId?: string;
  limit?: number;
};

export interface IWarehouseTransferOperationsRepository {
  getWarehouseTransfers(filters?: WarehouseTransferQueryFilters): Promise<WarehouseTransferWithDetails[]>;
  createWarehouseTransfer(input: CreateWarehouseTransferOperationInput): Promise<WarehouseTransfer>;
  acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer>;
}
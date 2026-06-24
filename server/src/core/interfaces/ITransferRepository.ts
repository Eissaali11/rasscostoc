import { WarehouseTransfer, InsertWarehouseTransfer, WarehouseTransferWithDetails } from "@shared/schema";

export interface ITransferRepository {
  getWarehouseTransfers(
    warehouseId?: string,
    technicianId?: string,
    regionId?: string,
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]>;
  
  transferFromWarehouse(data: InsertWarehouseTransfer): Promise<WarehouseTransfer>;
  acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer>;
  updateTransferStatus(transferId: string, status: 'pending' | 'approved' | 'rejected', performedBy?: string): Promise<WarehouseTransfer>;
}
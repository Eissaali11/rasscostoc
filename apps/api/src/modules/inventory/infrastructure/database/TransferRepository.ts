import { TransferQueryRepository, ITransferQueryRepository } from './TransferQueryRepository';
import { TransferExecutionRepository, ITransferExecutionRepository } from './TransferExecutionRepository';
import {
  WarehouseTransfer,
  InsertWarehouseTransfer,
  WarehouseTransferWithDetails
} from "@shared/schema";
import { ITransferRepository } from "@core/interfaces/ITransferRepository";

/**
 * Main Transfer Repository Implementation
 * Combines query and execution operations through delegation
 */
export class TransferRepository implements ITransferRepository {
  private queryRepo: ITransferQueryRepository;
  private executionRepo: ITransferExecutionRepository;

  constructor() {
    this.queryRepo = new TransferQueryRepository();
    this.executionRepo = new TransferExecutionRepository();
  }

  async getWarehouseTransfers(
    warehouseId?: string,
    technicianId?: string,
    regionId?: string,
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]> {
    return this.queryRepo.getWarehouseTransfers(warehouseId, technicianId, regionId, limit);
  }

  async transferFromWarehouse(data: InsertWarehouseTransfer): Promise<WarehouseTransfer> {
    return this.executionRepo.transferFromWarehouse(data);
  }

  async acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer> {
    return this.executionRepo.acceptWarehouseTransfer(transferId, performedBy);
  }

  async rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer> {
    return this.executionRepo.rejectWarehouseTransfer(transferId, reason, performedBy);
  }

  async updateTransferStatus(transferId: string, status: 'pending' | 'approved' | 'rejected', performedBy?: string): Promise<WarehouseTransfer> {
    if (status === 'approved') {
      return this.acceptWarehouseTransfer(transferId, performedBy);
    } else if (status === 'rejected') {
      return this.rejectWarehouseTransfer(transferId, 'Status updated to rejected', performedBy);
    } else {
      throw new Error('Cannot update transfer to pending status');
    }
  }
}
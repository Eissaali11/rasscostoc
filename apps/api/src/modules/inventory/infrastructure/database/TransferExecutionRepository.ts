import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import { DrizzleInventoryUnitOfWork } from "./DrizzleInventoryUnitOfWork";
import { processWarehouseTransferBatch } from "@modules/inventory/application/inventory/use-cases/warehouse-transfer-batch.processor";
import {
  warehouseTransfers,
  warehouseInventory,
  warehouseInventoryEntries,
  technicianMovingInventoryEntries,
  techniciansInventory,
  WarehouseTransfer,
  InsertWarehouseTransfer
} from "@shared/schema";

export interface ITransferExecutionRepository {
  transferFromWarehouse(data: InsertWarehouseTransfer): Promise<WarehouseTransfer>;
  acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer>;
  rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer>;
}

/**
 * Transfer Execution Repository Implementation
 * Handles transfer creation, acceptance, and rejection operations
 */
export class TransferExecutionRepository implements ITransferExecutionRepository {
  private get db() {
    return getDatabase();
  }

  async transferFromWarehouse(data: InsertWarehouseTransfer): Promise<WarehouseTransfer> {
    // v3.0: No warehouse stock validation needed.
    // Serials are created by the technician upon physical scanning (first-scan-creates model).
    // The supervisor simply assigns quantities — no pre-existing warehouse stock required.
    const [transfer] = await this.db
      .insert(warehouseTransfers)
      .values({
        ...data,
        status: 'pending',
      })
      .returning();

    if (!transfer) {
      throw new Error('Failed to create warehouse transfer');
    }

    return transfer;
  }

  async acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer> {
    const [existing] = await this.db
      .select()
      .from(warehouseTransfers)
      .where(eq(warehouseTransfers.id, transferId))
      .limit(1);

    if (!existing) {
      throw new Error('Transfer not found');
    }

    if (existing.status === 'accepted' || existing.status === 'approved') {
      return existing;
    }

    const unitOfWork = new DrizzleInventoryUnitOfWork();
    const approvedTransfers = await unitOfWork.execute(async (context) => {
      return processWarehouseTransferBatch(context, [transferId]);
    });

    const updatedTransfer = approvedTransfers[0] || existing;
    if (performedBy) {
      const [finalUpdated] = await this.db
        .update(warehouseTransfers)
        .set({ performedBy })
        .where(eq(warehouseTransfers.id, transferId))
        .returning();
      if (finalUpdated) return finalUpdated;
    }
    return updatedTransfer;
  }

  async rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer> {
    const [updatedTransfer] = await this.db
      .update(warehouseTransfers)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        performedBy: performedBy,
        respondedAt: new Date(),
      })
      .where(eq(warehouseTransfers.id, transferId))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Transfer not found');
    }
    return updatedTransfer;
  }
}
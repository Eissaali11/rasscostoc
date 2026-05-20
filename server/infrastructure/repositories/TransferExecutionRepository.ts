import { eq, and } from "drizzle-orm";
import { getDatabase } from "../database/connection";
import { DrizzleInventoryUnitOfWork } from "./inventory/DrizzleInventoryUnitOfWork";
import { processWarehouseTransferBatch } from "../../application/inventory/use-cases/warehouse-transfer-batch.processor";
import {
  warehouseTransfers,
  warehouseInventory,
  warehouseInventoryEntries,
  technicianMovingInventoryEntries,
  techniciansInventory,
  WarehouseTransfer,
  InsertWarehouseTransfer
} from "../schemas";

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
    return await this.db.transaction(async (tx) => {
      // Check warehouse_inventory_entries table first (new system)
      const itemTypeId = data.itemType;
      
      const [entry] = await tx
        .select()
        .from(warehouseInventoryEntries)
        .where(
          and(
            eq(warehouseInventoryEntries.warehouseId, data.warehouseId),
            eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
          )
        );
      
      if (entry) {
        // Found in entries table - use this as source of truth
        const currentStock = data.packagingType === 'box' ? entry.boxes : entry.units;
        
        if (currentStock < data.quantity) {
          throw new Error(`Insufficient stock in warehouse. Available: ${currentStock}, Requested: ${data.quantity}`);
        }
      } else {
        // Fall back to legacy warehouse_inventory table
        await this.validateLegacyInventory(tx, data);
      }

      // Create the transfer record
      const [transfer] = await tx
        .insert(warehouseTransfers)
        .values({
          ...data,
          status: 'pending',
        })
        .returning();

      return transfer;
    });
  }

  private async validateLegacyInventory(tx: any, data: InsertWarehouseTransfer): Promise<void> {
    // Legacy field mapping for old item types
    const fieldMap: Record<string, { boxes: string; units: string }> = {
      'n950': { boxes: 'n950Boxes', units: 'n950Units' },
      'i9000s': { boxes: 'i9000sBoxes', units: 'i9000sUnits' },
      'i9100': { boxes: 'i9100Boxes', units: 'i9100Units' },
      'rollPaper': { boxes: 'rollPaperBoxes', units: 'rollPaperUnits' },
      'stickers': { boxes: 'stickersBoxes', units: 'stickersUnits' },
      'newBatteries': { boxes: 'newBatteriesBoxes', units: 'newBatteriesUnits' },
      'mobilySim': { boxes: 'mobilySimBoxes', units: 'mobilySimUnits' },
      'stcSim': { boxes: 'stcSimBoxes', units: 'stcSimUnits' },
      'zainSim': { boxes: 'zainSimBoxes', units: 'zainSimUnits' },
      'lebaraSim': { boxes: 'lebaraBoxes', units: 'lebaraUnits' },
      'lebara': { boxes: 'lebaraBoxes', units: 'lebaraUnits' },
    };

    const fields = fieldMap[data.itemType];
    
    if (fields) {
      const [inventory] = await tx
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, data.warehouseId));

      if (!inventory) {
        throw new Error(`Warehouse inventory not found`);
      }

      const fieldName = data.packagingType === 'box' ? fields.boxes : fields.units;
      const currentStock = (inventory as any)[fieldName] || 0;

      if (currentStock < data.quantity) {
        throw new Error(`Insufficient stock in warehouse. Available: ${currentStock}, Requested: ${data.quantity}`);
      }
    } else {
      // New item type not in legacy system - no stock available
      throw new Error(`Insufficient stock in warehouse. Available: 0, Requested: ${data.quantity}`);
    }
  }

  async acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer> {
    const [transfer] = await new DrizzleInventoryUnitOfWork().execute(async (context) =>
      processWarehouseTransferBatch(context, [transferId])
    );

    if (!transfer) {
      throw new Error('Transfer not found');
    }

    return transfer;
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
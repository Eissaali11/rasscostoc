import type { WarehouseTransfer } from '@shared/schema';
import type { InventoryTransactionalContext } from '../contracts/IInventoryUnitOfWork';
import type { CreateStockMovementInput } from '../contracts/IStockMovementRepository';
import {
  assertValidWarehouseBatchAcceptance,
  WarehouseBatchValidationError,
} from "@modules/inventory/domain/warehouse-batch-acceptance.policy";
import { InventoryItemAggregate, InsufficientStockError } from "@modules/inventory/domain/inventory-item.aggregate";

export class WarehouseBatchStockError extends Error {
  constructor(public readonly transferId: string, message: string) {
    super(message);
    this.name = 'WarehouseBatchStockError';
  }
}

export async function processWarehouseTransferBatch(
  context: InventoryTransactionalContext,
  transferIds: string[]
): Promise<WarehouseTransfer[]> {
  if (transferIds.length === 0) {
    return [];
  }

  if (!context.warehouseTransferBatchRepository || !context.stockMovementRepository) {
    throw new Error('Warehouse batch dependencies are not configured in UnitOfWork');
  }

  const transfers = await context.warehouseTransferBatchRepository.getTransfersByIds(transferIds);

  assertValidWarehouseBatchAcceptance({
    transferIds,
    transfers,
  });

  for (const transfer of transfers) {
    const warehouseBalance = await context.warehouseTransferBatchRepository.getWarehouseBalance(
      transfer.warehouseId,
      transfer.itemType
    );

    const technicianBalance = await context.warehouseTransferBatchRepository.getTechnicianMovingBalance(
      transfer.technicianId,
      transfer.itemType
    );

    const sourceQuantity = transfer.packagingType === 'box' ? warehouseBalance.boxes : warehouseBalance.units;
    const destinationQuantity =
      transfer.packagingType === 'box' ? technicianBalance.boxes : technicianBalance.units;

    try {
      const sourceAfter = InventoryItemAggregate.fromCurrentQuantity(sourceQuantity).withdraw(
        transfer.quantity
      );
      const destinationAfter = InventoryItemAggregate.fromCurrentQuantity(destinationQuantity).add(
        transfer.quantity
      );

      if (transfer.packagingType === 'box') {
        await context.warehouseTransferBatchRepository.setWarehouseBalance(transfer.warehouseId, transfer.itemType, {
          ...warehouseBalance,
          boxes: sourceAfter,
        });
        await context.warehouseTransferBatchRepository.setTechnicianMovingBalance(
          transfer.technicianId,
          transfer.itemType,
          {
            ...technicianBalance,
            boxes: destinationAfter,
          }
        );
      } else {
        await context.warehouseTransferBatchRepository.setWarehouseBalance(transfer.warehouseId, transfer.itemType, {
          ...warehouseBalance,
          units: sourceAfter,
        });
        await context.warehouseTransferBatchRepository.setTechnicianMovingBalance(
          transfer.technicianId,
          transfer.itemType,
          {
            ...technicianBalance,
            units: destinationAfter,
          }
        );
      }
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new WarehouseBatchStockError(
          transfer.id,
          `Transfer ${transfer.id} failed: ${error.message}`
        );
      }
      if (error instanceof WarehouseBatchValidationError) {
        throw error;
      }
      throw error;
    }
  }

  const movementInputs: CreateStockMovementInput[] = transfers.map((transfer) => ({
    technicianId: transfer.technicianId,
    itemType: transfer.itemType,
    packagingType: transfer.packagingType,
    quantity: transfer.quantity,
    fromInventory: 'fixed',
    toInventory: 'moving',
    performedBy: transfer.performedBy,
    reason: transfer.notes || 'Warehouse transfer accepted',
    notes: transfer.notes || undefined,
  }));

  await context.stockMovementRepository.createMany(movementInputs);

  const approvedTransfers = await context.warehouseTransferBatchRepository.markTransfersApproved(transferIds);

  if (approvedTransfers.length !== transferIds.length) {
    throw new WarehouseBatchValidationError(
      'One or more transfers changed state during processing. Please retry.'
    );
  }

  return approvedTransfers;
}

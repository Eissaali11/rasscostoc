import type { StockMovement, TechnicianFixedInventory } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type { TransferPackagingType } from '../contracts/IStockMovementRepository';
import type { TransferInventoryType } from '../contracts/ITechnicianInventoryTransferRepository';
import {
  assertValidStockTransfer,
  calculateStockTransferBalances,
} from "@modules/inventory/domain/stock-transfer.policy";

export type TransferStockInput = {
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

export type TransferStockOutput = {
  movement: StockMovement;
  updatedInventory: TechnicianFixedInventory;
};

export class TransferStockUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: TransferStockInput): Promise<TransferStockOutput> {
    assertValidStockTransfer({
      quantity: input.quantity,
      fromInventory: input.fromInventory,
      toInventory: input.toInventory,
    });

    return this.unitOfWork.execute(async (context) => {
      if (!context.technicianInventoryTransferRepository || !context.stockMovementRepository) {
        throw new Error('Transfer stock dependencies are not configured in UnitOfWork');
      }

      const sourceBalance = await context.technicianInventoryTransferRepository.getBalance(
        input.technicianId,
        input.itemType,
        input.fromInventory
      );

      const destinationBalance = await context.technicianInventoryTransferRepository.getBalance(
        input.technicianId,
        input.itemType,
        input.toInventory
      );

      const { nextSource, nextDestination } = calculateStockTransferBalances({
        source: sourceBalance,
        destination: destinationBalance,
        packagingType: input.packagingType,
        quantity: input.quantity,
      });

      await context.technicianInventoryTransferRepository.setBalance(
        input.technicianId,
        input.itemType,
        input.fromInventory,
        nextSource
      );

      await context.technicianInventoryTransferRepository.setBalance(
        input.technicianId,
        input.itemType,
        input.toInventory,
        nextDestination
      );

      const movement = await context.stockMovementRepository.create({
        technicianId: input.technicianId,
        itemType: input.itemType,
        packagingType: input.packagingType,
        quantity: input.quantity,
        fromInventory: input.fromInventory,
        toInventory: input.toInventory,
        performedBy: input.performedBy,
        reason: input.reason,
        notes: input.notes,
      });

      const updatedInventory = await context.technicianInventoryTransferRepository.ensureTechnicianFixedInventory(
        input.technicianId
      );

      return { movement, updatedInventory };
    });
  }
}

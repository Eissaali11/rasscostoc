import {
  InvalidStockQuantityError,
  InventoryItemAggregate,
} from './inventory-item.aggregate';
import type { TransferPackagingType } from "@modules/inventory/application/inventory/contracts/IStockMovementRepository";
import type {
  TechnicianInventoryBalance,
  TransferInventoryType,
} from "@modules/inventory/application/inventory/contracts/ITechnicianInventoryTransferRepository";

export class SameInventoryTransferError extends Error {
  constructor() {
    super('Source and destination inventory cannot be the same');
    this.name = 'SameInventoryTransferError';
  }
}

export type StockTransferValidationInput = {
  quantity: number;
  fromInventory: TransferInventoryType;
  toInventory: TransferInventoryType;
};

export function assertValidStockTransfer(input: StockTransferValidationInput): void {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new InvalidStockQuantityError('Quantity must be a positive number');
  }

  if (input.fromInventory === input.toInventory) {
    throw new SameInventoryTransferError();
  }
}

export function calculateStockTransferBalances(params: {
  source: TechnicianInventoryBalance;
  destination: TechnicianInventoryBalance;
  packagingType: TransferPackagingType;
  quantity: number;
}): {
  nextSource: TechnicianInventoryBalance;
  nextDestination: TechnicianInventoryBalance;
} {
  const sourceCurrent =
    params.packagingType === 'box' ? params.source.boxes : params.source.units;
  const destinationCurrent =
    params.packagingType === 'box' ? params.destination.boxes : params.destination.units;

  const sourceAggregate = InventoryItemAggregate.fromCurrentQuantity(sourceCurrent);
  const destinationAggregate = InventoryItemAggregate.fromCurrentQuantity(destinationCurrent);

  const sourceAfter = sourceAggregate.withdraw(params.quantity);
  const destinationAfter = destinationAggregate.add(params.quantity);

  if (params.packagingType === 'box') {
    return {
      nextSource: {
        boxes: sourceAfter,
        units: params.source.units,
      },
      nextDestination: {
        boxes: destinationAfter,
        units: params.destination.units,
      },
    };
  }

  return {
    nextSource: {
      boxes: params.source.boxes,
      units: sourceAfter,
    },
    nextDestination: {
      boxes: params.destination.boxes,
      units: destinationAfter,
    },
  };
}

import type { WarehouseTransferRecord } from "@modules/inventory/application/inventory/contracts/IWarehouseTransferBatchRepository";

export class WarehouseBatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarehouseBatchValidationError';
  }
}

export type WarehouseBatchAcceptanceInput = {
  transferIds: string[];
  transfers: WarehouseTransferRecord[];
};

export function assertValidWarehouseBatchAcceptance(input: WarehouseBatchAcceptanceInput): void {
  if (!Array.isArray(input.transferIds) || input.transferIds.length === 0) {
    throw new WarehouseBatchValidationError('transferIds must be a non-empty array');
  }

  const uniqueIds = new Set(input.transferIds);
  if (uniqueIds.size !== input.transferIds.length) {
    throw new WarehouseBatchValidationError('transferIds must not contain duplicates');
  }

  if (input.transfers.length !== input.transferIds.length) {
    throw new WarehouseBatchValidationError('One or more transfers were not found');
  }

  for (const transfer of input.transfers) {
    if (transfer.status !== 'pending') {
      throw new WarehouseBatchValidationError(`Transfer ${transfer.id} is not pending`);
    }

    if (!Number.isFinite(transfer.quantity) || transfer.quantity <= 0) {
      throw new WarehouseBatchValidationError(`Transfer ${transfer.id} has invalid quantity`);
    }

    if (transfer.packagingType !== 'box' && transfer.packagingType !== 'unit') {
      throw new WarehouseBatchValidationError(`Transfer ${transfer.id} has invalid packaging type`);
    }
  }
}

import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type {
  LegacyStockField,
  LegacyStockSnapshot,
  WarehouseTransferAdminRecord,
} from '../contracts/IWarehouseTransferAdminRepository';

export type DeleteWarehouseTransfersInput = {
  ids: string[];
};

export type DeleteWarehouseTransfersOutput = {
  message: string;
  count: number;
};

const legacyFields: LegacyStockField[] = [
  'n950Boxes',
  'n950Units',
  'i9000sBoxes',
  'i9000sUnits',
  'i9100Boxes',
  'i9100Units',
  'rollPaperBoxes',
  'rollPaperUnits',
  'stickersBoxes',
  'stickersUnits',
  'newBatteriesBoxes',
  'newBatteriesUnits',
  'mobilySimBoxes',
  'mobilySimUnits',
  'stcSimBoxes',
  'stcSimUnits',
  'zainSimBoxes',
  'zainSimUnits',
];

const legacyTransferFieldMap: Record<string, { box: LegacyStockField; unit: LegacyStockField }> = {
  n950: { box: 'n950Boxes', unit: 'n950Units' },
  i9000s: { box: 'i9000sBoxes', unit: 'i9000sUnits' },
  i9100: { box: 'i9100Boxes', unit: 'i9100Units' },
  rollPaper: { box: 'rollPaperBoxes', unit: 'rollPaperUnits' },
  stickers: { box: 'stickersBoxes', unit: 'stickersUnits' },
  newBatteries: { box: 'newBatteriesBoxes', unit: 'newBatteriesUnits' },
  mobilySim: { box: 'mobilySimBoxes', unit: 'mobilySimUnits' },
  stcSim: { box: 'stcSimBoxes', unit: 'stcSimUnits' },
  zainSim: { box: 'zainSimBoxes', unit: 'zainSimUnits' },
};

function emptyLegacyStock(): LegacyStockSnapshot {
  return {
    n950Boxes: 0,
    n950Units: 0,
    i9000sBoxes: 0,
    i9000sUnits: 0,
    i9100Boxes: 0,
    i9100Units: 0,
    rollPaperBoxes: 0,
    rollPaperUnits: 0,
    stickersBoxes: 0,
    stickersUnits: 0,
    newBatteriesBoxes: 0,
    newBatteriesUnits: 0,
    mobilySimBoxes: 0,
    mobilySimUnits: 0,
    stcSimBoxes: 0,
    stcSimUnits: 0,
    zainSimBoxes: 0,
    zainSimUnits: 0,
  };
}

function applyDelta(target: LegacyStockSnapshot, transfer: WarehouseTransferAdminRecord): void {
  const mapping = legacyTransferFieldMap[transfer.itemType];
  if (!mapping) {
    return;
  }

  const field = transfer.packagingType === 'box' ? mapping.box : mapping.unit;
  target[field] += transfer.quantity;
}

export class DeleteWarehouseTransfersUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: DeleteWarehouseTransfersInput): Promise<DeleteWarehouseTransfersOutput> {
    return this.unitOfWork.execute(async (context) => {
      if (!context.warehouseTransferAdminRepository) {
        throw new Error('Warehouse transfer admin dependencies are not configured in UnitOfWork');
      }

      const repository = context.warehouseTransferAdminRepository;
      const transfersToDelete = await repository.getTransfersByIds(input.ids);

      if (transfersToDelete.length === 0) {
        throw new Error('No transfers found with the provided IDs');
      }

      const warehouseUpdates = new Map<string, LegacyStockSnapshot>();
      const technicianUpdates = new Map<string, LegacyStockSnapshot>();

      for (const transfer of transfersToDelete) {
        if (!warehouseUpdates.has(transfer.warehouseId)) {
          warehouseUpdates.set(transfer.warehouseId, emptyLegacyStock());
        }

        applyDelta(warehouseUpdates.get(transfer.warehouseId)!, transfer);

        if (transfer.status === 'accepted') {
          if (!technicianUpdates.has(transfer.technicianId)) {
            technicianUpdates.set(transfer.technicianId, emptyLegacyStock());
          }

          applyDelta(technicianUpdates.get(transfer.technicianId)!, transfer);
        }
      }

      for (const [warehouseId, updates] of Array.from(warehouseUpdates.entries())) {
        const currentInventory = await repository.getWarehouseInventoryByWarehouseId(warehouseId);
        if (!currentInventory) {
          throw new Error(`Warehouse inventory not found for warehouse ID: ${warehouseId}`);
        }

        const nextInventory = emptyLegacyStock();
        for (const field of legacyFields) {
          nextInventory[field] = currentInventory[field] + updates[field];
        }

        await repository.updateWarehouseInventoryByWarehouseId(warehouseId, nextInventory);
      }

      for (const [technicianId, updates] of Array.from(technicianUpdates.entries())) {
        const technicianName = await repository.getTechnicianFullNameById(technicianId);
        if (!technicianName) {
          throw new Error(`Technician not found for ID: ${technicianId}`);
        }

        const currentMovingInventory = await repository.getTechnicianMovingInventoryByName(technicianName);
        if (!currentMovingInventory) {
          throw new Error(`Moving inventory not found for technician: ${technicianName}`);
        }

        const nextMovingInventory = emptyLegacyStock();
        for (const field of legacyFields) {
          nextMovingInventory[field] = Math.max(0, currentMovingInventory[field] - updates[field]);
        }

        await repository.updateTechnicianMovingInventoryByName(technicianName, nextMovingInventory);
      }

      await repository.deleteTransfersByIds(input.ids);

      return {
        message: 'Transfers deleted successfully and inventory returned to warehouse',
        count: input.ids.length,
      };
    });
  }
}

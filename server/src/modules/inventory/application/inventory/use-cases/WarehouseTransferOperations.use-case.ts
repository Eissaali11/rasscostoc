import { z } from 'zod';
import type { WarehouseTransfer, WarehouseTransferWithDetails } from '@shared/schema';
import type {
  IWarehouseTransferOperationsRepository,
  WarehouseTransferOperationItem,
  WarehouseTransferQueryFilters,
} from '../contracts/IWarehouseTransferOperationsRepository';

const modernCreateSchema = z.object({
  warehouseId: z.string(),
  technicianId: z.string(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        itemType: z.string(),
        packagingType: z.enum(['box', 'unit']),
        quantity: z.number().positive(),
      })
    )
    .optional(),
  }).strict();

const legacyCreateSchema = z.object({
  warehouseId: z.string(),
  technicianId: z.string(),
  notes: z.string().optional(),
  n950: z.number().optional(),
  n950PackagingType: z.enum(['box', 'unit']).optional(),
  i9000s: z.number().optional(),
  i9000sPackagingType: z.enum(['box', 'unit']).optional(),
  i9100: z.number().optional(),
  i9100PackagingType: z.enum(['box', 'unit']).optional(),
  rollPaper: z.number().optional(),
  rollPaperPackagingType: z.enum(['box', 'unit']).optional(),
  stickers: z.number().optional(),
  stickersPackagingType: z.enum(['box', 'unit']).optional(),
  newBatteries: z.number().optional(),
  newBatteriesPackagingType: z.enum(['box', 'unit']).optional(),
  mobilySim: z.number().optional(),
  mobilySimPackagingType: z.enum(['box', 'unit']).optional(),
  stcSim: z.number().optional(),
  stcSimPackagingType: z.enum(['box', 'unit']).optional(),
  zainSim: z.number().optional(),
  zainSimPackagingType: z.enum(['box', 'unit']).optional(),
  lebara: z.number().optional(),
  lebaraPackagingType: z.enum(['box', 'unit']).optional(),
  lebaraSim: z.number().optional(),
  lebaraSimPackagingType: z.enum(['box', 'unit']).optional(),
});

export type CreateWarehouseTransfersInput = {
  warehouseId: string;
  technicianId: string;
  notes?: string;
  items: WarehouseTransferOperationItem[];
  performedBy: string;
};

export type CreateWarehouseTransfersOutput = {
  success: true;
  message: string;
  itemsCount: number;
};

export function normalizeCreateWarehouseTransferPayload(payload: unknown): Omit<CreateWarehouseTransfersInput, 'performedBy'> {
  const parsed = modernCreateSchema.safeParse(payload);

  if (parsed.success) {
    return {
      warehouseId: parsed.data.warehouseId,
      technicianId: parsed.data.technicianId,
      notes: parsed.data.notes,
      items: parsed.data.items || [],
    };
  }

  const legacy = legacyCreateSchema.parse(payload);

  const items: WarehouseTransferOperationItem[] = [];
  const itemTypes = [
    'n950',
    'i9000s',
    'i9100',
    'rollPaper',
    'stickers',
    'newBatteries',
    'mobilySim',
    'stcSim',
    'zainSim',
    'lebara',
    'lebaraSim',
  ] as const;

  for (const itemType of itemTypes) {
    const quantity = (legacy as any)[itemType];
    const packagingType = (legacy as any)[`${itemType}PackagingType`];
    if (quantity && quantity > 0 && (packagingType === 'box' || packagingType === 'unit')) {
      items.push({ itemType, packagingType, quantity });
    }
  }

  return {
    warehouseId: legacy.warehouseId,
    technicianId: legacy.technicianId,
    notes: legacy.notes,
    items,
  };
}

export class GetWarehouseTransfersUseCase {
  constructor(private readonly repository: IWarehouseTransferOperationsRepository) {}

  async execute(filters?: WarehouseTransferQueryFilters): Promise<WarehouseTransferWithDetails[]> {
    return this.repository.getWarehouseTransfers(filters);
  }
}

export class CreateWarehouseTransfersUseCase {
  constructor(private readonly repository: IWarehouseTransferOperationsRepository) {}

  async execute(input: CreateWarehouseTransfersInput): Promise<CreateWarehouseTransfersOutput> {
    if (input.items.length === 0) {
      throw new Error('No items to transfer');
    }

    for (const item of input.items) {
      await this.repository.createWarehouseTransfer({
        warehouseId: input.warehouseId,
        technicianId: input.technicianId,
        itemType: item.itemType,
        packagingType: item.packagingType,
        quantity: item.quantity,
        performedBy: input.performedBy,
        notes: input.notes,
      });
    }

    return {
      success: true,
      message: 'Transfer created',
      itemsCount: input.items.length,
    };
  }
}

export class AcceptWarehouseTransferUseCase {
  constructor(private readonly repository: IWarehouseTransferOperationsRepository) {}

  async execute(input: { transferId: string; performedBy?: string }): Promise<WarehouseTransfer> {
    return this.repository.acceptWarehouseTransfer(input.transferId, input.performedBy);
  }
}

export class RejectWarehouseTransferUseCase {
  constructor(private readonly repository: IWarehouseTransferOperationsRepository) {}

  async execute(input: { transferId: string; reason?: string; performedBy?: string }): Promise<WarehouseTransfer> {
    const reason = input.reason || 'Rejected';
    return this.repository.rejectWarehouseTransfer(input.transferId, reason, input.performedBy);
  }
}
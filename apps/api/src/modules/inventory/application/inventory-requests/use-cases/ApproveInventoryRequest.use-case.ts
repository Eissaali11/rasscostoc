import type { InventoryRequest, WarehouseInventory } from "@shared/schema";
import type {
  IInventoryRequestApprovalUnitOfWork,
  InventoryRequestApprovalActor,
} from '../contracts/IInventoryRequestApprovalUnitOfWork';
import { InventoryRequestApprovalError } from './InventoryRequestApproval.errors';

export type ApproveInventoryRequestInput = {
  requestId: string;
  warehouseId: string;
  adminNotes?: string;
  actor: InventoryRequestApprovalActor;
};

type LegacyItemDefinition = {
  itemType: string;
  requestBoxesField: keyof InventoryRequest;
  requestUnitsField: keyof InventoryRequest;
  inventoryBoxesField: keyof WarehouseInventory;
  inventoryUnitsField: keyof WarehouseInventory;
  stockLabelBoxes: string;
  stockLabelUnits: string;
};

const itemDefinitions: LegacyItemDefinition[] = [
  {
    itemType: 'n950',
    requestBoxesField: 'n950Boxes',
    requestUnitsField: 'n950Units',
    inventoryBoxesField: 'n950Boxes',
    inventoryUnitsField: 'n950Units',
    stockLabelBoxes: 'N950 (صناديق)',
    stockLabelUnits: 'N950 (وحدات)',
  },
  {
    itemType: 'i9000s',
    requestBoxesField: 'i9000sBoxes',
    requestUnitsField: 'i9000sUnits',
    inventoryBoxesField: 'i9000sBoxes',
    inventoryUnitsField: 'i9000sUnits',
    stockLabelBoxes: 'I9000s (صناديق)',
    stockLabelUnits: 'I9000s (وحدات)',
  },
  {
    itemType: 'i9100',
    requestBoxesField: 'i9100Boxes',
    requestUnitsField: 'i9100Units',
    inventoryBoxesField: 'i9100Boxes',
    inventoryUnitsField: 'i9100Units',
    stockLabelBoxes: 'I9100 (صناديق)',
    stockLabelUnits: 'I9100 (وحدات)',
  },
  {
    itemType: 'rollPaper',
    requestBoxesField: 'rollPaperBoxes',
    requestUnitsField: 'rollPaperUnits',
    inventoryBoxesField: 'rollPaperBoxes',
    inventoryUnitsField: 'rollPaperUnits',
    stockLabelBoxes: 'ورق حراري (صناديق)',
    stockLabelUnits: 'ورق حراري (وحدات)',
  },
  {
    itemType: 'stickers',
    requestBoxesField: 'stickersBoxes',
    requestUnitsField: 'stickersUnits',
    inventoryBoxesField: 'stickersBoxes',
    inventoryUnitsField: 'stickersUnits',
    stockLabelBoxes: 'ملصقات (صناديق)',
    stockLabelUnits: 'ملصقات (وحدات)',
  },
  {
    itemType: 'newBatteries',
    requestBoxesField: 'newBatteriesBoxes',
    requestUnitsField: 'newBatteriesUnits',
    inventoryBoxesField: 'newBatteriesBoxes',
    inventoryUnitsField: 'newBatteriesUnits',
    stockLabelBoxes: 'بطاريات جديدة (صناديق)',
    stockLabelUnits: 'بطاريات جديدة (وحدات)',
  },
  {
    itemType: 'mobilySim',
    requestBoxesField: 'mobilySimBoxes',
    requestUnitsField: 'mobilySimUnits',
    inventoryBoxesField: 'mobilySimBoxes',
    inventoryUnitsField: 'mobilySimUnits',
    stockLabelBoxes: 'شريحة موبايلي (صناديق)',
    stockLabelUnits: 'شريحة موبايلي (وحدات)',
  },
  {
    itemType: 'stcSim',
    requestBoxesField: 'stcSimBoxes',
    requestUnitsField: 'stcSimUnits',
    inventoryBoxesField: 'stcSimBoxes',
    inventoryUnitsField: 'stcSimUnits',
    stockLabelBoxes: 'شريحة STC (صناديق)',
    stockLabelUnits: 'شريحة STC (وحدات)',
  },
  {
    itemType: 'zainSim',
    requestBoxesField: 'zainSimBoxes',
    requestUnitsField: 'zainSimUnits',
    inventoryBoxesField: 'zainSimBoxes',
    inventoryUnitsField: 'zainSimUnits',
    stockLabelBoxes: 'شريحة زين (صناديق)',
    stockLabelUnits: 'شريحة زين (وحدات)',
  },
];

function asNumber(value: unknown): number {
  return Number(value || 0);
}

export class ApproveInventoryRequestUseCase {
  constructor(private readonly unitOfWork: IInventoryRequestApprovalUnitOfWork) {}

  async execute(input: ApproveInventoryRequestInput): Promise<InventoryRequest> {
    return this.unitOfWork.execute(async ({
      inventoryRequestRepository,
      userRegionLookupRepository,
      warehouseInventoryRepository,
      warehouseTransferRepository,
    }) => {
      const request = await inventoryRequestRepository.getById(input.requestId);
      if (!request) {
        throw new InventoryRequestApprovalError(404, 'Request not found');
      }

      if (request.status !== 'pending') {
        throw new InventoryRequestApprovalError(400, 'Request is not pending');
      }

      if (input.actor.role === 'supervisor') {
        const technician = await userRegionLookupRepository.getById(request.technicianId);
        if (!technician || technician.regionId !== input.actor.regionId) {
          throw new InventoryRequestApprovalError(403, 'لا يمكنك معالجة طلبات من خارج منطقتك');
        }
      }

      const warehouseInventory = await warehouseInventoryRepository.getByWarehouseId(input.warehouseId);
      if (!warehouseInventory) {
        throw new Error('Warehouse inventory not found');
      }

      for (const item of itemDefinitions) {
        const currentBoxes = asNumber(warehouseInventory[item.inventoryBoxesField]);
        const currentUnits = asNumber(warehouseInventory[item.inventoryUnitsField]);
        const requestedBoxes = asNumber(request[item.requestBoxesField]);
        const requestedUnits = asNumber(request[item.requestUnitsField]);

        if (requestedBoxes > 0 && currentBoxes < requestedBoxes) {
          throw new Error(
            `Insufficient stock in warehouse. Available: ${currentBoxes}, Requested: ${requestedBoxes} for ${item.stockLabelBoxes}`
          );
        }

        if (requestedUnits > 0 && currentUnits < requestedUnits) {
          throw new Error(
            `Insufficient stock in warehouse. Available: ${currentUnits}, Requested: ${requestedUnits} for ${item.stockLabelUnits}`
          );
        }
      }

      const approvedRequest = await inventoryRequestRepository.markApproved({
        id: input.requestId,
        adminNotes: input.adminNotes,
        warehouseId: input.warehouseId,
        respondedBy: input.actor.id,
        respondedAt: new Date(),
      });

      if (!approvedRequest) {
        throw new InventoryRequestApprovalError(404, 'Request not found');
      }

      const transferNotes = `تم إنشاؤه من طلب مخزون ${request.notes ? ': ' + request.notes : ''}`;
      for (const item of itemDefinitions) {
        const boxes = asNumber(request[item.requestBoxesField]);
        const units = asNumber(request[item.requestUnitsField]);

        if (boxes > 0) {
          await warehouseTransferRepository.create({
            requestId: input.requestId,
            warehouseId: input.warehouseId,
            technicianId: request.technicianId,
            itemType: item.itemType,
            packagingType: 'box',
            quantity: boxes,
            performedBy: input.actor.id,
            notes: transferNotes,
            status: 'pending',
          });
        }

        if (units > 0) {
          await warehouseTransferRepository.create({
            requestId: input.requestId,
            warehouseId: input.warehouseId,
            technicianId: request.technicianId,
            itemType: item.itemType,
            packagingType: 'unit',
            quantity: units,
            performedBy: input.actor.id,
            notes: transferNotes,
            status: 'pending',
          });
        }
      }

      await warehouseInventoryRepository.updateByWarehouseId(input.warehouseId, {
        n950Boxes: asNumber(warehouseInventory.n950Boxes) - asNumber(request.n950Boxes),
        n950Units: asNumber(warehouseInventory.n950Units) - asNumber(request.n950Units),
        i9000sBoxes: asNumber(warehouseInventory.i9000sBoxes) - asNumber(request.i9000sBoxes),
        i9000sUnits: asNumber(warehouseInventory.i9000sUnits) - asNumber(request.i9000sUnits),
        i9100Boxes: asNumber(warehouseInventory.i9100Boxes) - asNumber(request.i9100Boxes),
        i9100Units: asNumber(warehouseInventory.i9100Units) - asNumber(request.i9100Units),
        rollPaperBoxes: asNumber(warehouseInventory.rollPaperBoxes) - asNumber(request.rollPaperBoxes),
        rollPaperUnits: asNumber(warehouseInventory.rollPaperUnits) - asNumber(request.rollPaperUnits),
        stickersBoxes: asNumber(warehouseInventory.stickersBoxes) - asNumber(request.stickersBoxes),
        stickersUnits: asNumber(warehouseInventory.stickersUnits) - asNumber(request.stickersUnits),
        newBatteriesBoxes: asNumber(warehouseInventory.newBatteriesBoxes) - asNumber(request.newBatteriesBoxes),
        newBatteriesUnits: asNumber(warehouseInventory.newBatteriesUnits) - asNumber(request.newBatteriesUnits),
        mobilySimBoxes: asNumber(warehouseInventory.mobilySimBoxes) - asNumber(request.mobilySimBoxes),
        mobilySimUnits: asNumber(warehouseInventory.mobilySimUnits) - asNumber(request.mobilySimUnits),
        stcSimBoxes: asNumber(warehouseInventory.stcSimBoxes) - asNumber(request.stcSimBoxes),
        stcSimUnits: asNumber(warehouseInventory.stcSimUnits) - asNumber(request.stcSimUnits),
        zainSimBoxes: asNumber(warehouseInventory.zainSimBoxes) - asNumber(request.zainSimBoxes),
        zainSimUnits: asNumber(warehouseInventory.zainSimUnits) - asNumber(request.zainSimUnits),
      });

      return approvedRequest;
    });
  }
}

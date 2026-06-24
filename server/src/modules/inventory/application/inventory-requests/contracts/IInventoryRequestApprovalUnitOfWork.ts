import type { InventoryRequest, WarehouseInventory } from "@shared/schema";

export type InventoryRequestApprovalActor = {
  id: string;
  role: string;
  regionId?: string | null;
};

export type WarehouseTransferDraft = {
  requestId: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: 'box' | 'unit';
  quantity: number;
  performedBy: string;
  notes?: string | null;
  status: 'pending';
};

export interface IInventoryRequestApprovalRepository {
  getById(id: string): Promise<InventoryRequest | undefined>;
  markApproved(params: {
    id: string;
    adminNotes?: string;
    warehouseId: string;
    respondedBy: string;
    respondedAt: Date;
  }): Promise<InventoryRequest | undefined>;
  markRejected(params: {
    id: string;
    adminNotes: string;
    respondedBy: string;
    respondedAt: Date;
  }): Promise<InventoryRequest | undefined>;
}

export interface IUserRegionLookupRepository {
  getById(id: string): Promise<{ id: string; regionId: string | null } | undefined>;
}

export interface IWarehouseInventoryApprovalRepository {
  getByWarehouseId(warehouseId: string): Promise<WarehouseInventory | undefined>;
  updateByWarehouseId(warehouseId: string, updates: Partial<WarehouseInventory>): Promise<void>;
}

export interface IWarehouseTransferCreationRepository {
  create(transfer: WarehouseTransferDraft): Promise<void>;
}

export type InventoryRequestApprovalTransactionalContext = {
  inventoryRequestRepository: IInventoryRequestApprovalRepository;
  userRegionLookupRepository: IUserRegionLookupRepository;
  warehouseInventoryRepository: IWarehouseInventoryApprovalRepository;
  warehouseTransferRepository: IWarehouseTransferCreationRepository;
};

export interface IInventoryRequestApprovalUnitOfWork {
  execute<T>(
    work: (context: InventoryRequestApprovalTransactionalContext) => Promise<T>
  ): Promise<T>;
}

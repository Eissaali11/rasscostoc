import { eq } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import {
  inventoryRequests,
  users,
  warehouseInventory,
  warehouseTransfers,
  type InventoryRequest,
  type WarehouseInventory,
} from "@shared/schema";
import type {
  IInventoryRequestApprovalRepository,
  IInventoryRequestApprovalUnitOfWork,
  IWarehouseInventoryApprovalRepository,
  IWarehouseTransferCreationRepository,
  IUserRegionLookupRepository,
  InventoryRequestApprovalTransactionalContext,
  WarehouseTransferDraft,
} from "@modules/inventory/application/inventory-requests/contracts/IInventoryRequestApprovalUnitOfWork";

class DrizzleInventoryRequestApprovalRepository implements IInventoryRequestApprovalRepository {
  constructor(private readonly executor: any) {}

  async getById(id: string): Promise<InventoryRequest | undefined> {
    const [request] = await this.executor
      .select()
      .from(inventoryRequests)
      .where(eq(inventoryRequests.id, id))
      .limit(1);

    return request || undefined;
  }

  async markApproved(params: {
    id: string;
    adminNotes?: string;
    warehouseId: string;
    respondedBy: string;
    respondedAt: Date;
  }): Promise<InventoryRequest | undefined> {
    const [updated] = await this.executor
      .update(inventoryRequests)
      .set({
        status: 'approved',
        adminNotes: params.adminNotes,
        warehouseId: params.warehouseId,
        respondedBy: params.respondedBy,
        respondedAt: params.respondedAt,
      })
      .where(eq(inventoryRequests.id, params.id))
      .returning();

    return updated || undefined;
  }

  async markRejected(params: {
    id: string;
    adminNotes: string;
    respondedBy: string;
    respondedAt: Date;
  }): Promise<InventoryRequest | undefined> {
    const [updated] = await this.executor
      .update(inventoryRequests)
      .set({
        status: 'rejected',
        adminNotes: params.adminNotes,
        respondedBy: params.respondedBy,
        respondedAt: params.respondedAt,
      })
      .where(eq(inventoryRequests.id, params.id))
      .returning();

    return updated || undefined;
  }
}

class DrizzleUserRegionLookupRepository implements IUserRegionLookupRepository {
  constructor(private readonly executor: any) {}

  async getById(id: string): Promise<{ id: string; regionId: string | null } | undefined> {
    const [user] = await this.executor
      .select({
        id: users.id,
        regionId: users.regionId,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || undefined;
  }
}

class DrizzleWarehouseInventoryApprovalRepository implements IWarehouseInventoryApprovalRepository {
  constructor(private readonly executor: any) {}

  async getByWarehouseId(warehouseId: string): Promise<WarehouseInventory | undefined> {
    const [inventory] = await this.executor
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId))
      .limit(1);

    return inventory || undefined;
  }

  async updateByWarehouseId(warehouseId: string, updates: Partial<WarehouseInventory>): Promise<void> {
    await this.executor
      .update(warehouseInventory)
      .set(updates)
      .where(eq(warehouseInventory.warehouseId, warehouseId));
  }
}

class DrizzleWarehouseTransferCreationRepository implements IWarehouseTransferCreationRepository {
  constructor(private readonly executor: any) {}

  async create(transfer: WarehouseTransferDraft): Promise<void> {
    await this.executor.insert(warehouseTransfers).values(transfer);
  }
}

export class DrizzleInventoryRequestApprovalUnitOfWork implements IInventoryRequestApprovalUnitOfWork {
  private get db() {
    return getDatabase();
  }

  async execute<T>(
    work: (context: InventoryRequestApprovalTransactionalContext) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const context: InventoryRequestApprovalTransactionalContext = {
        inventoryRequestRepository: new DrizzleInventoryRequestApprovalRepository(tx),
        userRegionLookupRepository: new DrizzleUserRegionLookupRepository(tx),
        warehouseInventoryRepository: new DrizzleWarehouseInventoryApprovalRepository(tx),
        warehouseTransferRepository: new DrizzleWarehouseTransferCreationRepository(tx),
      };

      return work(context);
    });
  }
}

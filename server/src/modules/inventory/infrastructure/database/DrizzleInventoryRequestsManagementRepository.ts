import { eq } from 'drizzle-orm';
import type {
  IInventoryRequestsManagementRepository,
  UpdateInventoryRequestStatusInput,
} from "@modules/inventory/application/inventory-requests/contracts/IInventoryRequestsManagementRepository";
import { getDatabase } from "@core/database/connection";
import { inventoryRequests, type InventoryRequest } from "@shared/schema";

export class DrizzleInventoryRequestsManagementRepository implements IInventoryRequestsManagementRepository {
  private get db() {
    return getDatabase();
  }

  async updateStatus(input: UpdateInventoryRequestStatusInput): Promise<InventoryRequest> {
    const [updated] = await this.db
      .update(inventoryRequests)
      .set({
        status: input.status as any,
        respondedBy: input.respondedBy,
        respondedAt: new Date(),
        adminNotes: input.adminNotes,
      })
      .where(eq(inventoryRequests.id, input.id))
      .returning();

    if (!updated) {
      throw new Error(`Inventory request with id ${input.id} not found`);
    }

    return updated;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db
      .delete(inventoryRequests)
      .where(eq(inventoryRequests.id, id));

    return (result.rowCount || 0) > 0;
  }
}

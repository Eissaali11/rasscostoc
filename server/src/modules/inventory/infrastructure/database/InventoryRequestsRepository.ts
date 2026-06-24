import { eq, and, desc } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  inventoryRequests,
  InventoryRequest,
  InsertInventoryRequest,
  users,
} from "@shared/schema";

export interface IInventoryRequestsRepository {
  getInventoryRequests(warehouseId?: string, technicianId?: string, status?: string): Promise<(InventoryRequest & { technicianName: string })[]>;
  createInventoryRequest(request: InsertInventoryRequest): Promise<InventoryRequest>;
  updateInventoryRequest(id: string, updates: Partial<InsertInventoryRequest>): Promise<InventoryRequest>;
  deleteInventoryRequest(id: string): Promise<boolean>;
}

/**
 * Inventory Requests Repository Implementation
 * Handles all inventory request operations
 */
export class InventoryRequestsRepository implements IInventoryRequestsRepository {
  private get db() {
    return getDatabase();
  }

  async getInventoryRequests(warehouseId?: string, technicianId?: string, status?: string) {
    let query = this.db
      .select({
        request: inventoryRequests,
        technicianName: users.fullName,
      })
      .from(inventoryRequests)
      .leftJoin(users, eq(inventoryRequests.technicianId, users.id))
      .orderBy(desc(inventoryRequests.createdAt));

    const conditions = [];
    if (warehouseId) {
      conditions.push(eq(inventoryRequests.warehouseId, warehouseId));
    }
    if (technicianId) {
      conditions.push(eq(inventoryRequests.technicianId, technicianId));
    }
    if (status) {
      conditions.push(eq(inventoryRequests.status, status as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const rows = await query;
    return rows.map((row: any) => ({
      ...row.request,
      technicianName: row.technicianName || 'غير معروف',
    }));
  }

  async createInventoryRequest(request: InsertInventoryRequest): Promise<InventoryRequest> {
    const [created] = await this.db
      .insert(inventoryRequests)
      .values(request)
      .returning();
    return created;
  }

  async updateInventoryRequest(id: string, updates: Partial<InsertInventoryRequest>): Promise<InventoryRequest> {
    const [updated] = await this.db
      .update(inventoryRequests)
      .set(updates)
      .where(eq(inventoryRequests.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Inventory request with id ${id} not found`);
    }
    return updated;
  }

  async deleteInventoryRequest(id: string): Promise<boolean> {
    const result = await this.db
      .delete(inventoryRequests)
      .where(eq(inventoryRequests.id, id));
    return (result.rowCount || 0) > 0;
  }
}
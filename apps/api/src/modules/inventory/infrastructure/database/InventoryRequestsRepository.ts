import { eq, and, desc } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  inventoryRequests,
  InventoryRequest,
  InsertInventoryRequest,
  users,
} from "@shared/schema";

import type { IInventoryRequestsRepository } from "../../application/inventory-requests/contracts/IInventoryRequestsRepository";

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

  async getSupervisorRequestsByRegion(regionId: string, status?: string): Promise<any[]> {
    let query = this.db
      .select({
        id: inventoryRequests.id,
        technicianId: inventoryRequests.technicianId,
        technicianName: users.fullName,
        technicianUsername: users.username,
        technicianCity: users.city,
        n950Boxes: inventoryRequests.n950Boxes,
        n950Units: inventoryRequests.n950Units,
        i9000sBoxes: inventoryRequests.i9000sBoxes,
        i9000sUnits: inventoryRequests.i9000sUnits,
        i9100Boxes: inventoryRequests.i9100Boxes,
        i9100Units: inventoryRequests.i9100Units,
        rollPaperBoxes: inventoryRequests.rollPaperBoxes,
        rollPaperUnits: inventoryRequests.rollPaperUnits,
        stickersBoxes: inventoryRequests.stickersBoxes,
        stickersUnits: inventoryRequests.stickersUnits,
        newBatteriesBoxes: inventoryRequests.newBatteriesBoxes,
        newBatteriesUnits: inventoryRequests.newBatteriesUnits,
        mobilySimBoxes: inventoryRequests.mobilySimBoxes,
        mobilySimUnits: inventoryRequests.mobilySimUnits,
        stcSimBoxes: inventoryRequests.stcSimBoxes,
        stcSimUnits: inventoryRequests.stcSimUnits,
        zainSimBoxes: inventoryRequests.zainSimBoxes,
        zainSimUnits: inventoryRequests.zainSimUnits,
        notes: inventoryRequests.notes,
        status: inventoryRequests.status,
        adminNotes: inventoryRequests.adminNotes,
        respondedBy: inventoryRequests.respondedBy,
        respondedAt: inventoryRequests.respondedAt,
        createdAt: inventoryRequests.createdAt,
      })
      .from(inventoryRequests)
      .leftJoin(users, eq(inventoryRequests.technicianId, users.id))
      .orderBy(inventoryRequests.createdAt);

    const conditions = [eq(users.regionId, regionId)];
    if (status) {
      conditions.push(eq(inventoryRequests.status, status as any));
    }

    query = query.where(and(...conditions)) as any;

    return query;
  }
}
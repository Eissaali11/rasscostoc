import type { Express } from "express";
import { requireAuth, requireSupervisor } from "@core/middlewares/auth.middleware";
import { db } from "@core/config/db";
import { inventoryRequests, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Supervisor Requests Routes - طلبات المخزون (< 100 lines)
 * مجال المسؤولية: إدارة طلبات المخزون للمندوبين في المنطقة فقط
 */
export function registerSupervisorRequestsRoutes(app: Express): void {

  // عرض جميع طلبات المخزون في المنطقة
  app.get("/api/supervisor/inventory-requests", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (!user.regionId) {
        return res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات" });
      }
      
      const requests = await db
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
        .where(eq(users.regionId, user.regionId))
        .orderBy(inventoryRequests.createdAt);
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching supervisor inventory requests:", error);
      res.status(500).json({ message: "Failed to fetch inventory requests" });
    }
  });

  // عدد الطلبات المعلقة في المنطقة
  app.get("/api/supervisor/inventory-requests/pending/count", requireAuth, requireSupervisor, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (!user.regionId) {
        return res.status(400).json({ message: "المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات" });
      }
      
      const pendingRequests = await db
        .select()
        .from(inventoryRequests)
        .leftJoin(users, eq(inventoryRequests.technicianId, users.id))
        .where(and(
          eq(users.regionId, user.regionId),
          eq(inventoryRequests.status, "pending")
        ));
      
      res.json({ count: pendingRequests.length });
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });
}
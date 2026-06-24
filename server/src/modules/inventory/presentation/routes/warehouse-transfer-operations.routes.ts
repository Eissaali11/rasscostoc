import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { inventoryContainer } from "@server/composition/inventory.container";
import { normalizeCreateWarehouseTransferPayload } from "@modules/inventory/application/inventory/use-cases/WarehouseTransferOperations.use-case";

/**
 * Warehouse Transfer Operations - العمليات الأساسية للمناقلات (< 100 lines)
 * مجال المسؤولية: إنشاء وعرض وتحديث المناقلات (CRUD Operations)
 */
export function registerWarehouseTransferOperationsRoutes(app: Express): void {

  // عرض جميع المناقلات
  app.get("/api/warehouse-transfers", requireAuth, async (req, res) => {
    try {
      const transfers = await inventoryContainer.getWarehouseTransfersUseCase.execute();
      res.json(transfers);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error fetching warehouse transfers:", message);
      res.status(500).json({ message: "Failed to fetch warehouse transfers" });
    }
  });

  // إنشاء مناقلة جديدة
  app.post("/api/warehouse-transfers", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const normalized = normalizeCreateWarehouseTransferPayload(req.body);
      const result = await inventoryContainer.createWarehouseTransfersUseCase.execute({
        warehouseId: normalized.warehouseId,
        technicianId: normalized.technicianId,
        notes: normalized.notes,
        items: normalized.items,
        performedBy: user.id,
      });

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error creating warehouse transfer:", message);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      if (error instanceof Error && error.message === "No items to transfer") {
        return res.status(400).json({ message: "No items to transfer" });
      }
      res.status(500).json({ message: "Failed to create warehouse transfer" });
    }
  });

  // تحديث حالة المناقلة
  app.patch("/api/warehouse-transfers/:id/status", requireAuth, async (req, res) => {
    try {
      const status = String(req.body?.status || '').toLowerCase();
      if (status === 'approved' || status === 'accepted') {
        const transfer = await inventoryContainer.acceptWarehouseTransferUseCase.execute({
          transferId: req.params.id,
        });
        return res.json(transfer);
      }
      if (status === 'rejected') {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Rejected via status endpoint';
        const transfer = await inventoryContainer.rejectWarehouseTransferUseCase.execute({
          transferId: req.params.id,
          reason,
        });
        return res.json(transfer);
      }

      return res.status(400).json({ message: "Invalid status. Use approved|accepted|rejected" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error updating transfer status:", message);
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ message: "Transfer not found" });
      }
      res.status(500).json({ message: "Failed to update transfer status" });
    }
  });

  // قبول مناقلة
  app.post("/api/warehouse-transfers/:id/accept", requireAuth, async (req, res) => {
    try {
      const transfer = await inventoryContainer.acceptWarehouseTransferUseCase.execute({
        transferId: req.params.id,
      });
      res.json(transfer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error accepting warehouse transfer:", message);
      res.status(500).json({ message: "Failed to accept transfer" });
    }
  });

  // رفض مناقلة
  app.post("/api/warehouse-transfers/:id/reject", requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const transfer = await inventoryContainer.rejectWarehouseTransferUseCase.execute({
        transferId: req.params.id,
        reason,
      });
      res.json(transfer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error rejecting warehouse transfer:", message);
      res.status(500).json({ message: "Failed to reject transfer" });
    }
  });
}